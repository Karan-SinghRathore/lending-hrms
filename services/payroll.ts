import { db } from "@/lib/db";
import { computePay } from "@/lib/payroll";
import { addMonths, currentMonth, monthWorkingDays, toDateStr } from "@/lib/dates";
import { monthRegister } from "./attendance";
import { getHolidaySet } from "./holidays";
import { scorecard } from "./targets";
import { AppError, type Viewer } from "./viewer";

/** Payroll runs on closed months only. */
export function payrollMonths(): string[] {
  const now = currentMonth();
  return [addMonths(now, -1), addMonths(now, -2)];
}

/** Builds (or rebuilds) draft payslips for a closed month from attendance and incentive payouts. */
export async function runPayroll(v: Viewer, month: string) {
  if (v.role !== "HR") throw new AppError("Only HR can run payroll.", 403);
  if (!payrollMonths().includes(month)) throw new AppError("Payroll can be run for the last two closed months.");
  const paid = await db.payslip.count({ where: { month, status: "PAID" } });
  if (paid) throw new AppError("This month is already paid and locked.");

  const [holidays, register, card, employees] = await Promise.all([
    getHolidaySet(),
    monthRegister(v, month),
    scorecard(v, month),
    db.employee.findMany({ where: { status: "ACTIVE" } }),
  ]);
  const workingDays = monthWorkingDays(month, holidays).length;
  const absent = new Map(register.rows.map((r) => [r.id, r.absent + r.days.filter((d) => d === "HALF_DAY").length * 0.5]));
  const hasAttendance = register.rows.some((r) => r.present > 0);
  const incentive = new Map(card.rows.map((r) => [r.employeeId, r.incentive]));

  const lines = employees
    .filter((e) => toDateStr(e.joinDate).slice(0, 7) <= month)
    .map((e) => ({
      employeeId: e.id,
      month,
      // If attendance was never recorded for the month, nobody is docked.
      ...computePay(e.monthlyCtc, workingDays, hasAttendance ? (absent.get(e.id) ?? 0) : 0, incentive.get(e.id) ?? 0),
    }));

  await db.$transaction([db.payslip.deleteMany({ where: { month } }), db.payslip.createMany({ data: lines })]);
  return { count: lines.length, attendanceUsed: hasAttendance };
}

export async function markPaid(v: Viewer, month: string) {
  if (v.role !== "HR") throw new AppError("Only HR can release payroll.", 403);
  const res = await db.payslip.updateMany({ where: { month, status: "DRAFT" }, data: { status: "PAID", paidAt: new Date() } });
  if (!res.count) throw new AppError("Nothing to release — run payroll first, or it is already paid.");
  return { count: res.count };
}

/** HR sees everyone; anyone else sees only their own released payslips. */
export async function listPayslips(v: Viewer, month?: string) {
  return db.payslip.findMany({
    where: v.role === "HR" ? { month } : { employeeId: v.id, status: "PAID" },
    include: { employee: { include: { branch: true } } },
    orderBy: [{ month: "desc" }, { employee: { name: "asc" } }],
  });
}
