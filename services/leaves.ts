import { db } from "@/lib/db";
import { LEAVE_TYPES, type LeaveType } from "@/lib/config";
import { todayStr, workingDaysBetween } from "@/lib/dates";
import { getHolidaySet } from "./holidays";
import { AppError, employeeScope, type Viewer } from "./viewer";

export type LeaveBalance = {
  type: LeaveType;
  label: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
};

export function countLeaveDays(from: string, to: string, halfDay: boolean, holidays: Set<string>) {
  if (halfDay) return workingDaysBetween(from, from, holidays).length ? 0.5 : 0;
  return workingDaysBetween(from, to, holidays).length;
}

export async function getBalances(employeeId: number, year = Number(todayStr().slice(0, 4))) {
  const [allocations, requests] = await Promise.all([
    db.leaveAllocation.findMany({ where: { employeeId, year } }),
    db.leaveRequest.findMany({
      where: {
        employeeId,
        fromDate: { gte: `${year}-01-01`, lte: `${year}-12-31` },
        status: { in: ["APPROVED", "PENDING"] },
      },
    }),
  ]);
  return (Object.keys(LEAVE_TYPES) as LeaveType[]).map<LeaveBalance>((type) => {
    const allocated = allocations.find((a) => a.type === type)?.allocated ?? 0;
    const used = requests
      .filter((r) => r.type === type && r.status === "APPROVED")
      .reduce((s, r) => s + r.days, 0);
    const pending = requests
      .filter((r) => r.type === type && r.status === "PENDING")
      .reduce((s, r) => s + r.days, 0);
    return { type, label: LEAVE_TYPES[type].label, allocated, used, pending, available: allocated - used - pending };
  });
}

const requestInclude = {
  employee: { include: { branch: true } },
  approver: { select: { name: true } },
} as const;

export async function listRequests(v: Viewer, opts: { mine?: boolean } = {}) {
  const where = opts.mine ? { employeeId: v.id } : { employee: employeeScope(v) };
  return db.leaveRequest.findMany({
    where,
    include: requestInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });
}

/** Pending requests this viewer is allowed to approve. */
export async function approvalQueue(v: Viewer) {
  if (v.role === "EMPLOYEE") return [];
  return db.leaveRequest.findMany({
    where: {
      status: "PENDING",
      employeeId: { not: v.id },
      employee: v.role === "HR" ? {} : { managerId: v.id },
    },
    include: requestInclude,
    orderBy: { fromDate: "asc" },
  });
}

export async function onLeaveOn(v: Viewer, date = todayStr()) {
  return db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      fromDate: { lte: date },
      toDate: { gte: date },
      employee: employeeScope(v),
    },
    include: requestInclude,
    orderBy: { toDate: "asc" },
  });
}

export async function applyLeave(
  v: Viewer,
  input: { type: string; fromDate: string; toDate: string; halfDay: boolean; reason: string },
) {
  const type = input.type as LeaveType;
  if (!LEAVE_TYPES[type]) throw new AppError("Choose a leave type.");
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(input.fromDate) || !re.test(input.toDate)) throw new AppError("Choose the leave dates.");
  const toDate = input.halfDay ? input.fromDate : input.toDate;
  if (toDate < input.fromDate) throw new AppError("End date is before start date.");
  if (!input.reason.trim()) throw new AppError("Add a reason.");

  const holidays = await getHolidaySet();
  const days = countLeaveDays(input.fromDate, toDate, input.halfDay, holidays);
  if (days === 0) throw new AppError("The selected dates are holidays or Sundays.");

  const overlap = await db.leaveRequest.findFirst({
    where: {
      employeeId: v.id,
      status: { in: ["PENDING", "APPROVED"] },
      fromDate: { lte: toDate },
      toDate: { gte: input.fromDate },
    },
  });
  if (overlap) throw new AppError("You already have a leave request on these dates.");

  const balance = (await getBalances(v.id, Number(input.fromDate.slice(0, 4)))).find((b) => b.type === type)!;
  if (balance.available < days) {
    throw new AppError(
      `Not enough ${balance.label} balance: ${balance.available} day(s) left, ${days} requested.`,
    );
  }

  return db.leaveRequest.create({
    data: {
      employeeId: v.id,
      type,
      fromDate: input.fromDate,
      toDate,
      halfDay: input.halfDay,
      days,
      reason: input.reason.trim(),
    },
  });
}

export async function decideLeave(
  v: Viewer,
  id: number,
  action: "APPROVE" | "REJECT" | "CANCEL",
  remark?: string,
) {
  const req = await db.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!req) throw new AppError("Leave request not found.", 404);
  if (req.status !== "PENDING") throw new AppError(`This request is already ${req.status.toLowerCase()}.`);

  if (action === "CANCEL") {
    if (req.employeeId !== v.id) throw new AppError("Only the applicant can cancel.", 403);
    return db.leaveRequest.update({ where: { id }, data: { status: "CANCELLED", decidedAt: new Date() } });
  }

  const allowed =
    req.employeeId !== v.id &&
    (v.role === "HR" || (v.role === "MANAGER" && req.employee.managerId === v.id));
  if (!allowed) throw new AppError("You can't approve this request.", 403);

  return db.leaveRequest.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      approverId: v.id,
      remark: remark?.trim() || null,
      decidedAt: new Date(),
    },
  });
}
