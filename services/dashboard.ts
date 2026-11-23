import { db } from "@/lib/db";
import { addMonths, currentMonth, todayStr } from "@/lib/dates";
import { todayBoard } from "./attendance";
import { addDays, isWorkingDay } from "@/lib/dates";
import { getHolidays, getHolidaySet } from "./holidays";
import { approvalQueue, getBalances, listRequests, onLeaveOn } from "./leaves";
import { scorecard, scorecardFor, summariseByBranch } from "./targets";
import { addMonths as prevMonth } from "@/lib/dates";
import { can, employeeScope, type Viewer } from "./viewer";

/** Counts from the other modules, only for the modules this role can open. */
async function extras(v: Viewer, month: string, today: string) {
  const emp = v.role === "HR" ? {} : { branchId: v.branchId };
  const jobs = v.role === "HR" ? {} : { branchId: v.branchId };
  const lastMonth = prevMonth(month, -1);
  const [joiners, openJobs, pipeline, offers, hiredNotAdded, docsToVerify, openChecklists, overdueTraining, appraisalsWaiting, slips] = await Promise.all([
    db.employee.count({ where: { ...employeeScope(v), joinDate: { gte: new Date(`${month}-01T00:00:00`) } } }),
    can(v, "recruitment") ? db.jobOpening.findMany({ where: { ...jobs, status: "OPEN" }, select: { openings: true } }) : [],
    can(v, "recruitment") ? db.candidate.count({ where: { job: { ...jobs, status: "OPEN" }, stage: { in: ["APPLIED", "SCREENING", "INTERVIEW"] } } }) : 0,
    can(v, "recruitment") ? db.candidate.count({ where: { job: jobs, stage: "OFFERED" } }) : 0,
    can(v, "recruitment") && v.role === "HR" ? db.candidate.count({ where: { stage: "HIRED", employeeId: null } }) : 0,
    can(v, "documents") && v.role === "HR" ? db.employeeDocument.count({ where: { verified: false } }) : 0,
    can(v, "onboarding") ? db.checklistCase.count({ where: { employee: emp, tasks: { some: { done: false } } } }) : 0,
    can(v, "training") ? db.trainingProgram.count({ where: { dueDate: { lt: today }, assignments: { some: { status: "ASSIGNED", employee: emp } } } }) : 0,
    can(v, "appraisals")
      ? db.appraisal.count({
          where: { cycle: { status: "OPEN" }, ...(v.role === "HR" ? { status: "HR", employeeId: { not: v.id } } : { status: "MANAGER", employee: { managerId: v.id } }) },
        })
      : 0,
    can(v, "payroll") && v.role === "HR" ? db.payslip.findMany({ where: { month: lastMonth }, select: { net: true, status: true } }) : [],
  ]);
  return {
    joiners,
    recruitment: can(v, "recruitment") ? { openPositions: openJobs.length, seats: openJobs.reduce((s, j) => s + j.openings, 0), pipeline, offers } : null,
    payroll:
      can(v, "payroll") && v.role === "HR"
        ? { month: lastMonth, net: slips.reduce((s, p) => s + p.net, 0), status: !slips.length ? "NONE" : slips.every((p) => p.status === "PAID") ? "PAID" : "DRAFT" }
        : null,
    actions: [
      { label: "Documents to verify", count: docsToVerify, href: "/documents" },
      { label: "Hired candidates to add as employee", count: hiredNotAdded, href: "/recruitment" },
      { label: "Appraisals waiting on you", count: appraisalsWaiting, href: "/appraisals" },
      { label: "Joining / exit checklists open", count: openChecklists, href: "/onboarding" },
      { label: "Trainings past due date", count: overdueTraining, href: "/training" },
    ].filter((a) => a.count > 0),
  };
}

/** Data for the dashboard charts, in the viewer's scope. */
async function chartData(v: Viewer, today: string, headcount: number) {
  const holidays = await getHolidaySet();
  // Last 12 working days up to today.
  const days: string[] = [];
  for (let d = today; days.length < 12; d = addDays(d, -1)) if (isWorkingDay(d, holidays)) days.unshift(d);
  const year = today.slice(0, 4);
  const [attendance, departments, leaves] = await Promise.all([
    db.attendance.groupBy({ by: ["date"], where: { date: { gte: days[0], lte: today }, employee: employeeScope(v) }, _count: true }),
    db.employee.groupBy({ by: ["department"], where: employeeScope(v), _count: true }),
    db.leaveRequest.groupBy({ by: ["type"], where: { status: "APPROVED", fromDate: { startsWith: year }, employee: employeeScope(v) }, _sum: { days: true } }),
  ]);
  const byDate = new Map(attendance.map((a) => [a.date, a._count]));
  return {
    attendanceTrend: days.map((d) => ({ date: d, present: byDate.get(d) ?? 0, pct: headcount ? Math.round(((byDate.get(d) ?? 0) / headcount) * 100) : 0 })),
    departments: departments.map((d) => ({ name: d.department, count: d._count })).sort((x, y) => y.count - x.count),
    leaveByType: leaves.map((l) => ({ type: l.type, days: l._sum.days ?? 0 })),
    year,
  };
}

export async function teamDashboard(v: Viewer) {
  const month = currentMonth();
  const today = todayStr();
  const [more, headcount, branchCount, board, onLeave, queue, card, holidays] = await Promise.all([
    extras(v, month, today),
    db.employee.count({ where: employeeScope(v) }),
    db.branch.count(),
    todayBoard(v),
    onLeaveOn(v),
    approvalQueue(v),
    scorecard(v, month),
    getHolidays(),
  ]);

  const present = board.filter((b) => ["PRESENT", "LATE", "HALF_DAY"].includes(b.status)).length;
  const late = board.filter((b) => b.status === "LATE").length;
  const notIn = board.filter((b) => b.status === "NOT_IN").length;
  const expectedIn = board.filter((b) => !["ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"].includes(b.status)).length;
  const dayOff = board[0]?.status === "HOLIDAY" || board[0]?.status === "WEEKLY_OFF" ? board[0].status : null;

  const totals = card.rows.reduce(
    (t, r) => {
      for (const m of r.metrics) {
        if (m.metric === "DISBURSAL") {
          t.disbursalTarget += m.target;
          t.disbursalAchieved += m.achieved;
        }
        if (m.metric === "COLLECTION") {
          t.collectionTarget += m.target;
          t.collectionAchieved += m.achieved;
        }
      }
      return t;
    },
    { disbursalTarget: 0, disbursalAchieved: 0, collectionTarget: 0, collectionAchieved: 0 },
  );

  return {
    month,
    headcount,
    branchCount,
    attendance: { present, late, notIn, expectedIn, dayOff },
    onLeave: onLeave.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      name: l.employee.name,
      branch: l.employee.branch.name,
      designation: l.employee.designation,
      type: l.type,
      toDate: l.toDate,
    })),
    pendingApprovals: queue.length,
    progress: card.progress,
    totals,
    standing: {
      onTrack: card.rows.filter((r) => r.standing === "ON_TRACK").length,
      atRisk: card.rows.filter((r) => r.standing === "AT_RISK").length,
      behind: card.rows.filter((r) => r.standing === "BEHIND").length,
    },
    branches: summariseByBranch(card.rows),
    top: card.rows.slice(0, 5),
    bottom: card.rows.slice(-5).reverse(),
    team: card.rows,
    incentiveEstimate: card.rows.reduce((s, r) => s + r.incentive, 0),
    lateToday: board.filter((b) => b.status === "LATE").map((b) => b.name),
    ...more,
    charts: await chartData(v, today, headcount),
    holidays: holidays.filter((h) => h.date >= today).slice(0, 3),
  };
}

export async function myDashboard(v: Viewer) {
  const month = currentMonth();
  const today = todayStr();
  const [card, previous, balances, requests, attendance, holidays] = await Promise.all([
    scorecardFor(v, month),
    Promise.all([addMonths(month, -1), addMonths(month, -2)].map((m) => scorecardFor(v, m))),
    getBalances(v.id),
    listRequests(v, { mine: true }),
    db.attendance.findMany({ where: { employeeId: v.id, date: { startsWith: month } }, orderBy: { date: "desc" } }),
    getHolidays(),
  ]);
  return {
    month,
    progress: card.progress,
    score: card.rows[0] ?? null,
    history: previous
      .filter((c) => c.rows[0])
      .map((c) => ({ month: c.month, score: c.rows[0].score, incentive: c.rows[0].incentive, rank: c.rows[0].rank })),
    balances,
    requests: requests.slice(0, 5).map((r) => ({
      id: r.id,
      type: r.type,
      fromDate: r.fromDate,
      toDate: r.toDate,
      days: r.days,
      status: r.status,
    })),
    today: attendance.find((a) => a.date === today) ?? null,
    monthAttendance: {
      present: attendance.length - attendance.filter((a) => a.status === "HALF_DAY").length * 0.5,
      late: attendance.filter((a) => a.status === "LATE").length,
    },
    holidays: holidays.filter((h) => h.date >= today).slice(0, 3),
  };
}
