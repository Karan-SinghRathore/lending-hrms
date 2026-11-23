// Demo data for a lending company: 4 branches, 46 people, 3 months of targets,
// attendance and leave. Data is built around today's date, so re-run
// `npm run seed` on the morning of a demo to get a fresh "today".
import { PrismaClient } from "@prisma/client";
import { CHECKLISTS, MODULES } from "../lib/config";
import { longDate, toDateStr } from "../lib/dates";
import { LETTERS } from "../lib/letters";
import { computePay } from "../lib/payroll";
import { slabFor, weightedScore } from "../lib/scoring";
import {
  addDays,
  addMonths,
  currentMonth,
  isSunday,
  monthProgress,
  monthWorkingDays,
  todayStr,
  workingDaysBetween,
} from "../lib/dates";

const db = new PrismaClient();

// Deterministic random so every seed looks the same.
let seed = 20261123;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const BRANCHES = [
  { code: "JPR", name: "Jaipur", city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { code: "IDR", name: "Indore", city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { code: "PNQ", name: "Pune", city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { code: "LKO", name: "Lucknow", city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
];

type Kind = "BM" | "LO" | "CO" | "CR" | "OPS";
const PEOPLE: Record<string, { name: string; gender: "M" | "F"; kind: Kind }[]> = {
  JPR: [
    { name: "Rohit Verma", gender: "M", kind: "BM" },
    { name: "Ankit Jain", gender: "M", kind: "LO" },
    { name: "Pooja Sharma", gender: "F", kind: "LO" },
    { name: "Vikas Meena", gender: "M", kind: "LO" },
    { name: "Sunita Choudhary", gender: "F", kind: "LO" },
    { name: "Harsh Agarwal", gender: "M", kind: "LO" },
    { name: "Mahendra Shekhawat", gender: "M", kind: "CO" },
    { name: "Rakesh Gurjar", gender: "M", kind: "CO" },
    { name: "Kavita Saini", gender: "F", kind: "CO" },
    { name: "Deepak Khandelwal", gender: "M", kind: "CR" },
    { name: "Manisha Joshi", gender: "F", kind: "OPS" },
  ],
  IDR: [
    { name: "Amit Patidar", gender: "M", kind: "BM" },
    { name: "Shruti Jain", gender: "F", kind: "LO" },
    { name: "Rahul Malviya", gender: "M", kind: "LO" },
    { name: "Nikhil Chouhan", gender: "M", kind: "LO" },
    { name: "Priyanka Raghuwanshi", gender: "F", kind: "LO" },
    { name: "Gaurav Solanki", gender: "M", kind: "LO" },
    { name: "Sanjay Yadav", gender: "M", kind: "CO" },
    { name: "Ritesh Dangi", gender: "M", kind: "CO" },
    { name: "Anjali Parmar", gender: "F", kind: "CO" },
    { name: "Mukesh Gupta", gender: "M", kind: "CR" },
    { name: "Swati Dubey", gender: "F", kind: "OPS" },
  ],
  PNQ: [
    { name: "Sachin Kulkarni", gender: "M", kind: "BM" },
    { name: "Aditya Deshpande", gender: "M", kind: "LO" },
    { name: "Sneha Patil", gender: "F", kind: "LO" },
    { name: "Omkar Jadhav", gender: "M", kind: "LO" },
    { name: "Pallavi Shinde", gender: "F", kind: "LO" },
    { name: "Rohan Pawar", gender: "M", kind: "LO" },
    { name: "Ganesh More", gender: "M", kind: "CO" },
    { name: "Vaibhav Gaikwad", gender: "M", kind: "CO" },
    { name: "Ashwini Bhosale", gender: "F", kind: "CO" },
    { name: "Prasad Joshi", gender: "M", kind: "CR" },
    { name: "Rutuja Kale", gender: "F", kind: "OPS" },
  ],
  LKO: [
    { name: "Alok Srivastava", gender: "M", kind: "BM" },
    { name: "Shivam Mishra", gender: "M", kind: "LO" },
    { name: "Ritu Tiwari", gender: "F", kind: "LO" },
    { name: "Ankur Pandey", gender: "M", kind: "LO" },
    { name: "Shalini Verma", gender: "F", kind: "LO" },
    { name: "Abhishek Tripathi", gender: "M", kind: "LO" },
    { name: "Rajesh Yadav", gender: "M", kind: "CO" },
    { name: "Vivek Shukla", gender: "M", kind: "CO" },
    { name: "Pooja Maurya", gender: "F", kind: "CO" },
    { name: "Manoj Awasthi", gender: "M", kind: "CR" },
    { name: "Nidhi Saxena", gender: "F", kind: "OPS" },
  ],
};

const ROLE_INFO: Record<Kind, { designation: string; department: string; plan: string; ctc: [number, number] }> = {
  BM: { designation: "Branch Manager", department: "Branch Management", plan: "NONE", ctc: [95000, 130000] },
  LO: { designation: "Relationship Officer", department: "Sales", plan: "SALES", ctc: [28000, 42000] },
  CO: { designation: "Collection Officer", department: "Collections", plan: "COLLECTION", ctc: [24000, 34000] },
  CR: { designation: "Credit Executive", department: "Credit", plan: "NONE", ctc: [35000, 45000] },
  OPS: { designation: "Operations Executive", department: "Operations", plan: "NONE", ctc: [22000, 28000] },
};

const email = (name: string) => `${name.toLowerCase().replace(/\s+/g, ".")}@demofinance.in`;
const phone = () => `9${int(100000000, 999999999)}`;

function holidaysFor(year: number) {
  return [
    [`${year}-01-26`, "Republic Day"],
    [`${year}-03-04`, "Holi"],
    [`${year}-04-03`, "Good Friday"],
    [`${year}-05-01`, "Labour Day"],
    [`${year}-08-15`, "Independence Day"],
    [`${year}-08-28`, "Raksha Bandhan"],
    [`${year}-10-02`, "Gandhi Jayanti"],
    [`${year}-10-20`, "Dussehra"],
    [`${year}-11-09`, "Diwali (Govardhan Puja)"],
    [`${year}-12-25`, "Christmas"],
  ] as const;
}

async function main() {
  const today = todayStr();
  const year = Number(today.slice(0, 4));
  const month = currentMonth();
  const months = [addMonths(month, -2), addMonths(month, -1), month];

  // Wipe in dependency order.
  await db.trainingProgram.deleteMany();
  await db.employeeDocument.deleteMany();
  await db.letter.deleteMany();
  await db.jobOpening.deleteMany();
  await db.appraisalCycle.deleteMany();
  await db.checklistCase.deleteMany();
  await db.payslip.deleteMany();
  await db.target.deleteMany();
  await db.attendance.deleteMany();
  await db.leaveRequest.deleteMany();
  await db.leaveAllocation.deleteMany();
  await db.employee.deleteMany({ where: { managerId: { not: null } } });
  await db.employee.deleteMany();
  await db.role.deleteMany();
  await db.branch.deleteMany();
  await db.holiday.deleteMany();
  await db.incentiveSlab.deleteMany();

  const holidayRows = [...holidaysFor(year), ...holidaysFor(year + 1).slice(0, 1)];
  await db.holiday.createMany({ data: holidayRows.map(([date, name]) => ({ date, name })) });
  const holidays = new Set<string>(holidayRows.map(([d]) => d));

  await db.incentiveSlab.createMany({
    data: [
      { plan: "SALES", minPct: 0, maxPct: 90, amount: 0 },
      { plan: "SALES", minPct: 90, maxPct: 100, amount: 3000 },
      { plan: "SALES", minPct: 100, maxPct: 110, amount: 6000 },
      { plan: "SALES", minPct: 110, maxPct: 120, amount: 8500 },
      { plan: "SALES", minPct: 120, maxPct: null, amount: 12000 },
      { plan: "COLLECTION", minPct: 0, maxPct: 90, amount: 0 },
      { plan: "COLLECTION", minPct: 90, maxPct: 100, amount: 2500 },
      { plan: "COLLECTION", minPct: 100, maxPct: 110, amount: 5000 },
      { plan: "COLLECTION", minPct: 110, maxPct: 120, amount: 7500 },
      { plan: "COLLECTION", minPct: 120, maxPct: null, amount: 10000 },
    ],
  });

  const branches = new Map<string, { id: string; lat: number; lng: number }>();
  for (const b of BRANCHES) {
    const row = await db.branch.create({ data: b });
    branches.set(b.code, row);
  }

  let codeNo = 1001;
  const nextCode = () => `EMP-${codeNo++}`;
  const randomJoin = () =>
    new Date(int(2019, 2025), int(0, 11), int(1, 28));

  // Head office HR sits in Jaipur.
  const jpr = branches.get("JPR")!;
  const hrHead = await db.employee.create({
    data: {
      code: nextCode(), name: "Neha Agarwal", email: email("Neha Agarwal"), phone: phone(), gender: "F",
      designation: "HR Manager", department: "Human Resources", accessRole: "HR", plan: "NONE",
      joinDate: new Date(2019, 6, 1), monthlyCtc: 92000, branchId: jpr.id,
    },
  });
  await db.employee.create({
    data: {
      code: nextCode(), name: "Saurabh Mathur", email: email("Saurabh Mathur"), phone: phone(), gender: "M",
      designation: "HR Executive", department: "Human Resources", accessRole: "EMPLOYEE", plan: "NONE",
      joinDate: new Date(2022, 1, 14), monthlyCtc: 36000, branchId: jpr.id, managerId: hrHead.id,
    },
  });

  type Emp = { id: string; name: string; kind: Kind; branchCode: string; branchId: string };
  const staff: Emp[] = [];
  for (const b of BRANCHES) {
    const branch = branches.get(b.code)!;
    let managerId: string | null = null;
    for (const p of PEOPLE[b.code]) {
      const info = ROLE_INFO[p.kind];
      const row: { id: string } = await db.employee.create({
        data: {
          code: nextCode(), name: p.name, email: email(p.name), phone: phone(), gender: p.gender,
          designation: info.designation, department: info.department,
          accessRole: p.kind === "BM" ? "MANAGER" : "EMPLOYEE", plan: info.plan,
          joinDate: p.name === "Ankit Jain" ? new Date(2023, 3, 10) : randomJoin(),
          monthlyCtc: roundTo(between(...info.ctc), 500), branchId: branch.id, managerId,
        },
      });
      if (p.kind === "BM") managerId = row.id;
      staff.push({ id: row.id, name: p.name, kind: p.kind, branchCode: b.code, branchId: branch.id });
    }
  }
  const everyone = await db.employee.findMany();
  const byName = new Map(everyone.map((e) => [e.name, e]));

  // ---- Roles: which modules each kind of user can open
  const allModules = Object.keys(MODULES);
  const without = (...drop: string[]) => allModules.filter((m) => !drop.includes(m));
  const role = (name: string, base: string, modules: string[], locked = false) =>
    db.role.create({ data: { name, base, modules: JSON.stringify(modules), locked } });
  const hrAdmin = await role("HR Admin", "HR", allModules, true);
  const hrExec = await role("HR Executive", "HR", without("payroll", "incentives", "users"));
  const branchMgr = await role("Branch Manager", "MANAGER", without("users"));
  const accounts = await role("Accounts", "HR", ["dashboard", "payroll", "incentives"]);
  const employeeRole = await role("Employee", "EMPLOYEE", without("recruitment", "users"));
  await db.employee.updateMany({ where: { accessRole: "EMPLOYEE" }, data: { roleId: employeeRole.id } });
  await db.employee.updateMany({ where: { accessRole: "MANAGER" }, data: { roleId: branchMgr.id } });
  await db.employee.update({ where: { id: hrHead.id }, data: { roleId: hrAdmin.id } });
  await db.employee.update({ where: { id: byName.get("Saurabh Mathur")!.id }, data: { roleId: hrExec.id, accessRole: "HR" } });
  // Head-office accounts person: sees payroll and incentives only.
  await db.employee.update({ where: { id: byName.get("Manisha Joshi")!.id }, data: { roleId: accounts.id, accessRole: "HR", designation: "Accounts Executive", department: "Accounts" } });

  // ---- Leave allocations + history -------------------------------------
  await db.leaveAllocation.createMany({
    data: everyone.flatMap((e) => [
      { employeeId: e.id, year, type: "CL", allocated: 8 },
      { employeeId: e.id, year, type: "SL", allocated: 7 },
      { employeeId: e.id, year, type: "EL", allocated: 15 },
    ]),
  });

  const REASONS: Record<string, string[]> = {
    CL: ["Family function", "Personal work", "Bank and property paperwork", "Child's school event", "Travelling home"],
    SL: ["Fever", "Viral infection", "Doctor's appointment", "Back pain", "Food poisoning"],
    EL: ["Family trip", "Sister's wedding", "Native place visit", "Vacation"],
  };
  const leaveRows: {
    employeeId: string; type: string; fromDate: string; toDate: string; halfDay: boolean; days: number;
    reason: string; status: string; approverId: string | null; decidedAt: Date | null; createdAt: Date;
  }[] = [];
  const approverOf = (e: (typeof everyone)[number]) => e.managerId ?? hrHead.id;
  const busy = new Map<string, [string, string][]>();
  const addLeave = (
    e: (typeof everyone)[number], type: string, from: string, to: string, status: string, halfDay = false,
  ) => {
    const days = halfDay ? 0.5 : workingDaysBetween(from, to, holidays).length;
    if (!days) return;
    const ranges = busy.get(e.id) ?? [];
    if (ranges.some(([a, b]) => a <= to && b >= from)) return;
    ranges.push([from, to]);
    busy.set(e.id, ranges);
    const decided = status !== "PENDING";
    leaveRows.push({
      employeeId: e.id, type, fromDate: from, toDate: to, halfDay, days, reason: pick(REASONS[type]), status,
      approverId: decided ? approverOf(e) : null,
      decidedAt: decided ? new Date(`${addDays(from, -2)}T11:20:00`) : null,
      createdAt: new Date(`${addDays(from, decided ? -4 : -1)}T10:05:00`),
    });
  };

  // Fixed stories for the demo: who is on leave today, and what is waiting for approval.
  const todayIsWorking = !isSunday(today) && !holidays.has(today);
  const nextWorking = (from: string, n: number) => {
    let d = from;
    let left = n;
    while (left > 0) {
      d = addDays(d, 1);
      if (!isSunday(d) && !holidays.has(d)) left--;
    }
    return d;
  };
  const onLeaveToday = [
    ["Pooja Sharma", "SL", addDays(today, -1), today],
    ["Rahul Malviya", "CL", today, today],
    ["Sneha Patil", "EL", today, nextWorking(today, 2)],
    ["Ritu Tiwari", "SL", today, nextWorking(today, 1)],
  ] as const;
  for (const [name, type, from, to] of onLeaveToday) addLeave(byName.get(name)!, type, from, to, "APPROVED");

  const pending = [
    ["Vikas Meena", "EL", nextWorking(today, 6), nextWorking(today, 8), false],
    ["Kavita Saini", "SL", nextWorking(today, 2), nextWorking(today, 2), true],
    ["Gaurav Solanki", "CL", nextWorking(today, 4), nextWorking(today, 4), false],
    ["Omkar Jadhav", "EL", nextWorking(today, 10), nextWorking(today, 14), false],
    ["Shivam Mishra", "CL", nextWorking(today, 3), nextWorking(today, 3), false],
    ["Alok Srivastava", "EL", nextWorking(today, 12), nextWorking(today, 15), false],
  ] as const;
  for (const [name, type, from, to, half] of pending) addLeave(byName.get(name)!, type, from, to, "PENDING", half);

  // History from January up to last week.
  for (const e of everyone) {
    for (let m = 1; m <= Number(month.slice(5)); m++) {
      if (rand() > 0.38) continue;
      const mm = `${year}-${String(m).padStart(2, "0")}`;
      const days = monthWorkingDays(mm, holidays).filter((d) => d < addDays(today, -6));
      if (!days.length) continue;
      const type = rand() < 0.45 ? "CL" : rand() < 0.65 ? "SL" : "EL";
      const len = type === "EL" ? int(2, 4) : int(1, 2);
      const from = pick(days);
      const to = nextWorking(from, len - 1);
      if (to >= addDays(today, -6)) continue;
      addLeave(e, type, from, to, rand() < 0.06 ? "REJECTED" : "APPROVED", type !== "EL" && rand() < 0.12);
    }
  }
  // Ankit has a clean recent history so the demo "apply leave" is the first open request.
  await db.leaveRequest.createMany({ data: leaveRows });

  // ---- Attendance -------------------------------------------------------
  const approvedLeave = leaveRows.filter((l) => l.status === "APPROVED");
  const onLeave = (empId: string, d: string) =>
    approvedLeave.some((l) => l.employeeId === empId && l.fromDate <= d && l.toDate >= d && !l.halfDay);
  const habituallyLate = new Set(["Rakesh Gurjar", "Nikhil Chouhan", "Vivek Shukla"]);
  const now = new Date();
  const attendanceRows: {
    employeeId: string; date: string; checkIn: Date; checkOut: Date | null; lat: number; lng: number;
    location: string; status: string;
  }[] = [];
  const branchById = new Map([...branches.entries()].map(([code, b]) => [b.id, { ...b, name: BRANCHES.find((x) => x.code === code)!.name }]));

  for (const mm of [addMonths(month, -1), month]) {
    for (const d of monthWorkingDays(mm, holidays).filter((x) => x <= today)) {
      for (const e of everyone) {
        if (onLeave(e.id, d)) continue;
        if (d === today && e.name === "Ankit Jain") continue; // he checks in live during the demo
        const isToday = d === today;
        if (!isToday && rand() < 0.01) continue; // absent
        if (isToday && rand() < 0.12) continue; // not in yet
        const lateBias = habituallyLate.has(e.name) ? 25 : 0;
        const inMin = 9 * 60 + 5 + int(0, 45) + lateBias;
        const checkIn = new Date(`${d}T${String(Math.floor(inMin / 60)).padStart(2, "0")}:${String(inMin % 60).padStart(2, "0")}:00`);
        if (isToday && checkIn > now) continue;
        const halfDay = !isToday && rand() < 0.012;
        const outMin = halfDay ? 13 * 60 + int(15, 45) : 18 * 60 + int(0, 95);
        let checkOut: Date | null = new Date(`${d}T${String(Math.floor(outMin / 60)).padStart(2, "0")}:${String(outMin % 60).padStart(2, "0")}:00`);
        if (isToday && checkOut > now) checkOut = null;
        const branch = branchById.get(e.branchId)!;
        const field = (e.plan === "SALES" || e.plan === "COLLECTION") && rand() < 0.4;
        const lat = field ? branch.lat + between(-0.06, 0.06) : branch.lat;
        const lng = field ? branch.lng + between(-0.06, 0.06) : branch.lng;
        const km = field ? Math.hypot((lat - branch.lat) * 111, (lng - branch.lng) * 102) : 0;
        attendanceRows.push({
          employeeId: e.id, date: d, checkIn, checkOut, lat, lng,
          location: field ? `Field · ${km.toFixed(1)} km from ${branch.name} branch` : `${branch.name} branch`,
          status: halfDay ? "HALF_DAY" : inMin > 9 * 60 + 45 ? "LATE" : "PRESENT",
        });
      }
    }
  }
  await db.attendance.createMany({ data: attendanceRows });

  // ---- Targets ----------------------------------------------------------
  const skill = new Map<string, number>();
  const stars = new Set(["Shruti Jain", "Aditya Deshpande", "Ganesh More", "Harsh Agarwal"]);
  const laggards = new Set(["Abhishek Tripathi", "Ritesh Dangi", "Pallavi Shinde"]);
  for (const e of everyone) {
    skill.set(e.id, stars.has(e.name) ? between(1.2, 1.32) : laggards.has(e.name) ? between(0.66, 0.78) : between(0.84, 1.14));
  }

  const targetRows: { employeeId: string; month: string; metric: string; target: number; achieved: number; weight: number }[] = [];
  for (const mm of months) {
    const progress = monthProgress(mm, holidays, today);
    for (const e of everyone) {
      if (e.plan === "NONE") continue;
      let factor = skill.get(e.id)! * between(0.9, 1.1);
      if (e.name === "Ankit Jain") factor = mm === months[1] ? 1.12 : mm === month ? 1.05 : 0.97;
      const f = (base: number) => base * Math.max(0.3, factor * between(0.94, 1.06)) * progress;
      if (e.plan === "SALES") {
        const disb = roundTo(between(3500000, 6000000), 50000);
        const files = int(10, 18);
        targetRows.push(
          { employeeId: e.id, month: mm, metric: "DISBURSAL", target: disb, achieved: roundTo(f(disb), 1000), weight: 70 },
          { employeeId: e.id, month: mm, metric: "FILES", target: files, achieved: Math.round(f(files)), weight: 30 },
        );
      } else {
        const coll = roundTo(between(2000000, 3500000), 50000);
        const cases = int(50, 90);
        const cf = (base: number) => base * Math.max(0.5, (1 + (factor - 1) * 0.6) * between(0.96, 1.04)) * progress;
        targetRows.push(
          { employeeId: e.id, month: mm, metric: "COLLECTION", target: coll, achieved: roundTo(cf(coll), 1000), weight: 70 },
          { employeeId: e.id, month: mm, metric: "RESOLVED", target: cases, achieved: Math.round(cf(cases)), weight: 30 },
        );
      }
    }
  }
  // Ankit's numbers are fixed so the demo story is exact:
  // last month 111% → ₹8,500 slab; this month on track at about 106% projected.
  const ankit = byName.get("Ankit Jain")!;
  const nowProgress = monthProgress(month, holidays, today);
  for (const t of targetRows) {
    if (t.employeeId !== ankit.id) continue;
    if (t.month === months[1]) {
      if (t.metric === "DISBURSAL") Object.assign(t, { target: 5000000, achieved: 5650000 });
      if (t.metric === "FILES") Object.assign(t, { target: 15, achieved: 16 });
    }
    if (t.month === month) {
      if (t.metric === "DISBURSAL") Object.assign(t, { target: 4500000, achieved: roundTo(4500000 * nowProgress * 1.07, 1000) });
      if (t.metric === "FILES") Object.assign(t, { target: 14, achieved: Math.round(14 * nowProgress * 1.05) });
    }
  }
  await db.target.createMany({ data: targetRows });

  // ---- Payroll: the month before last is already paid; last month is left for the demo run.
  const slabRows = await db.incentiveSlab.findMany();
  const paidMonth = months[0];
  const paidWorkingDays = monthWorkingDays(paidMonth, holidays).length;
  await db.payslip.createMany({
    data: everyone.map((e) => {
      const mine = targetRows.filter((t) => t.employeeId === e.id && t.month === paidMonth);
      const slab = mine.length ? slabFor(weightedScore(mine), slabRows.filter((x) => x.plan === e.plan)) : null;
      const lop = rand() < 0.15 ? pick([0.5, 1, 1, 2]) : 0;
      return {
        employeeId: e.id,
        month: paidMonth,
        ...computePay(e.monthlyCtc, paidWorkingDays, lop, slab?.amount ?? 0),
        status: "PAID",
        paidAt: new Date(`${addMonths(paidMonth, 1)}-01T11:00:00`),
      };
    }),
  });

  // ---- Joining / exit checklists
  const checklist = async (name: string, kind: "JOINING" | "EXIT", doneUpTo: number, daysAgo: number) => {
    const e = byName.get(name)!;
    await db.checklistCase.create({
      data: {
        employeeId: e.id,
        kind,
        startedAt: new Date(`${addDays(today, -daysAgo)}T10:30:00`),
        tasks: {
          create: CHECKLISTS[kind].map((t, i) => ({
            ...t,
            sort: i,
            done: i < doneUpTo,
            doneBy: i < doneUpTo ? (t.owner === "HR" ? "Neha Agarwal" : t.owner === "EMPLOYEE" ? name : "Branch manager") : null,
            doneAt: i < doneUpTo ? new Date(`${addDays(today, -daysAgo + 1 + Math.floor(i / 2))}T15:00:00`) : null,
          })),
        },
      },
    });
  };
  await checklist("Harsh Agarwal", "JOINING", 6, 9);
  await checklist("Nidhi Saxena", "JOINING", 3, 5);
  await checklist("Rutuja Kale", "JOINING", 9, 30);
  await checklist("Ritesh Dangi", "EXIT", 2, 4);

  // ---- Appraisal cycle in progress, with reviews at every step
  const cycleTo = months[0];
  const cycleFrom = addMonths(cycleTo, -5);
  const SELF_NOTES = ["Met most targets; field visits took longer in the monsoon.", "Good quarter on disbursal, need support on documentation turnaround.", "Collections improved after route planning; want product training.", "Steady half-year, would like to handle bigger ticket files."];
  const MGR_NOTES = ["Dependable, follows process. Should push harder on file count.", "Strong with customers, numbers consistent. Ready for more responsibility.", "Needs closer follow-up on pending cases; attitude is good.", "Good performer, can mentor new joiners."];
  await db.appraisalCycle.create({
    data: {
      name: "Half-yearly review",
      fromMonth: cycleFrom,
      toMonth: cycleTo,
      appraisals: {
        create: everyone
          .filter((e) => e.accessRole !== "HR")
          .map((e, i) => {
            const mine = targetRows.filter((t) => t.employeeId === e.id && t.month === cycleTo);
            const targetScore = mine.length ? weightedScore(mine) : null;
            // Ankit still has to write his self review; the rest are spread across the steps.
            let status = ["DONE", "HR", "MANAGER", "SELF", "MANAGER", "DONE", "HR"][i % 7];
            if (e.name === "Ankit Jain") status = "SELF";
            if (!e.managerId && status === "MANAGER") status = "HR";
            const base = targetScore == null ? 3 : targetScore >= 115 ? 5 : targetScore >= 100 ? 4 : targetScore >= 85 ? 3 : 2;
            const selfDone = status !== "SELF";
            const mgrDone = (status === "HR" || status === "DONE") && !!e.managerId;
            return {
              employeeId: e.id,
              targetScore,
              status,
              selfRating: selfDone ? Math.min(5, base + (rand() < 0.4 ? 1 : 0)) : null,
              selfComment: selfDone ? pick(SELF_NOTES) : null,
              managerRating: mgrDone ? base : null,
              managerComment: mgrDone ? pick(MGR_NOTES) : null,
              finalRating: status === "DONE" ? base : null,
              incrementPct: status === "DONE" ? [0, 0, 5, 8, 10, 12][base] : null,
              hrComment: status === "DONE" ? "Agreed with manager rating." : null,
            };
          }),
      },
    },
  });

  // ---- Recruitment
  const CANDIDATES = [
    ["Lokesh Sharma", "Employee referral", "HIRED", 34000, "3 yrs in two-wheeler loans at a local NBFC"],
    ["Divya Rathi", "Job portal", "OFFERED", 36000, "Good on documentation, notice period 15 days"],
    ["Imran Khan", "Walk-in", "INTERVIEW", 30000, "Knows the Sanganer market well"],
    ["Komal Jangid", "Job portal", "SCREENING", 32000, null],
    ["Sumit Bairwa", "Consultant", "APPLIED", null, null],
    ["Tarun Soni", "Walk-in", "REJECTED", 45000, "Expectation too high for the role"],
    ["Arvind Yadav", "Employee referral", "INTERVIEW", 27000, "2 yrs field collection, own bike"],
    ["Seema Rawat", "Job portal", "SCREENING", 26000, null],
    ["Faizan Ali", "Walk-in", "APPLIED", 25000, null],
  ] as const;
  const job = async (title: string, code: string, openings: number, status: string, daysAgo: number, picks: number[]) => {
    await db.jobOpening.create({
      data: {
        title,
        branchId: branches.get(code)!.id,
        openings,
        status,
        createdAt: new Date(`${addDays(today, -daysAgo)}T10:00:00`),
        candidates: {
          create: picks.map((i, n) => ({
            name: CANDIDATES[i][0],
            phone: phone(),
            source: CANDIDATES[i][1],
            stage: CANDIDATES[i][2],
            expectedCtc: CANDIDATES[i][3],
            notes: CANDIDATES[i][4],
            createdAt: new Date(`${addDays(today, -daysAgo + 1 + n)}T12:00:00`),
          })),
        },
      },
    });
  };
  await job("Relationship Officer", "JPR", 2, "OPEN", 12, [0, 1, 2, 3, 4, 5]);
  await job("Collection Officer", "LKO", 1, "OPEN", 7, [6, 7, 8]);
  await job("Operations Executive", "PNQ", 1, "CLOSED", 40, []);

  // ---- Letters issued from templates
  const latest = await db.employee.findMany({ include: { branch: true } });
  const letter = async (name: string, type: string, daysAgo: number) => {
    const e = latest.find((x) => x.name === name)!;
    const on = addDays(today, -daysAgo);
    await db.letter.create({
      data: {
        employeeId: e.id,
        type,
        issuedBy: "Neha Agarwal",
        issuedAt: new Date(`${on}T16:00:00`),
        body: LETTERS[type].body({
          name: e.name, code: e.code, designation: e.designation, department: e.department, branch: e.branch.name,
          joinDate: longDate(toDateStr(e.joinDate)), monthlyCtc: e.monthlyCtc, today: longDate(on), signedBy: "Neha Agarwal",
        }),
      },
    });
  };
  await letter("Ankit Jain", "SALARY_CERTIFICATE", 20);
  await letter("Ankit Jain", "CONFIRMATION", 400);
  await letter("Harsh Agarwal", "APPOINTMENT", 9);
  await letter("Nidhi Saxena", "APPOINTMENT", 5);
  await letter("Shruti Jain", "SALARY_CERTIFICATE", 33);

  // ---- KYC documents (small placeholder PDFs so the files open)
  const pdf = (text: string) => {
    const stream = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
    return Buffer.from(
      `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`,
    );
  };
  const docPeople = ["Ankit Jain", "Harsh Agarwal", "Nidhi Saxena", "Pooja Sharma", "Vikas Meena", "Shruti Jain", "Ganesh More", "Rajesh Yadav"];
  for (const [i, name] of docPeople.entries()) {
    const e = byName.get(name)!;
    for (const [k, kind] of ["Aadhaar card", "PAN card", "Bank proof"].entries()) {
      if (name === "Nidhi Saxena" && k > 0) continue; // new joiner, still submitting
      const verified = (i + k) % 3 !== 0;
      const data = pdf(`Sample ${kind} - ${name} (demo file)`);
      await db.employeeDocument.create({
        data: {
          employeeId: e.id, kind, fileName: `${name.toLowerCase().replace(/ /g, "-")}-${kind.toLowerCase().replace(/ /g, "-")}.pdf`,
          mime: "application/pdf", size: data.length, data, uploadedBy: k === 2 ? "Neha Agarwal" : name,
          uploadedAt: new Date(`${addDays(today, -(30 - i * 3 - k))}T11:00:00`), verified, verifiedBy: verified ? "Neha Agarwal" : null,
        },
      });
    }
  }

  // ---- Trainings
  const training = async (title: string, category: string, mandatory: boolean, dueIn: number | null, description: string, who: (e: (typeof everyone)[number]) => boolean, doneShare: number) => {
    const people = everyone.filter(who);
    await db.trainingProgram.create({
      data: {
        title, category, mandatory, description,
        dueDate: dueIn === null ? null : addDays(today, dueIn),
        createdAt: new Date(`${addDays(today, -25)}T10:00:00`),
        assignments: {
          create: people.map((e) => {
            const done = e.name !== "Ankit Jain" && rand() < doneShare;
            return { employeeId: e.id, status: done ? "COMPLETED" : "ASSIGNED", completedAt: done ? new Date(`${addDays(today, -int(1, 20))}T17:00:00`) : null, markedBy: done ? e.name : null };
          }),
        },
      },
    });
  };
  await training("KYC and AML refresher", "Compliance", true, -5, "Annual refresher on customer identification and suspicious transaction reporting. 45 minutes, branch session.", () => true, 0.85);
  await training("Fair Practices Code and customer conduct", "Compliance", true, 10, "What staff can and cannot say or do with borrowers. Required for all customer-facing staff.", () => true, 0.6);
  await training("Recovery calls and visits: do's and don'ts", "Collections conduct", true, 20, "Calling hours, language, third-party contact rules for collection staff.", (e) => e.plan === "COLLECTION", 0.4);
  await training("Loan against property: product walkthrough", "Product", false, null, "Eligibility, documents and pricing for the LAP product.", (e) => e.plan === "SALES", 0.5);

  console.log(
    `Seeded ${everyone.length} employees, ${leaveRows.length} leave requests, ${attendanceRows.length} attendance rows, ${targetRows.length} targets. Today = ${today}${todayIsWorking ? "" : " (not a working day)"}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
