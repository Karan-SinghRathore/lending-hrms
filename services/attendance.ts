import { db } from "@/lib/db";
import { LATE_AFTER } from "@/lib/config";
import { daysInMonth, isSunday, toDateStr, todayStr } from "@/lib/dates";
import { getHolidaySet } from "./holidays";
import { AppError, employeeScope, type Viewer } from "./viewer";

export type DayStatus =
  | "PRESENT"
  | "LATE"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "ABSENT"
  | "NOT_IN"
  | "HOLIDAY"
  | "WEEKLY_OFF"
  | "UPCOMING";

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function describeLocation(lat: number, lng: number, branch: { name: string; lat: number; lng: number }) {
  const km = distanceKm(lat, lng, branch.lat, branch.lng);
  if (km <= 0.5) return `${branch.name} branch`;
  if (km < 50) return `Field · ${km.toFixed(1)} km from ${branch.name} branch`;
  return `Outstation · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export async function getToday(employeeId: string) {
  return db.attendance.findUnique({ where: { employeeId_date: { employeeId, date: todayStr() } } });
}

export async function checkInOut(v: Viewer, kind: "in" | "out", lat?: number, lng?: number) {
  const date = todayStr();
  const holidays = await getHolidaySet();
  if (holidays.has(date)) throw new AppError("Today is a company holiday.");
  if (isSunday(date)) throw new AppError("Today is a weekly off.");

  const existing = await getToday(v.id);
  const emp = await db.employee.findUniqueOrThrow({ where: { id: v.id }, include: { branch: true } });
  const location =
    lat != null && lng != null ? describeLocation(lat, lng, emp.branch) : "Location not shared";

  if (kind === "in") {
    if (existing?.checkIn) throw new AppError("You have already checked in today.");
    const now = new Date();
    const late =
      now.getHours() > LATE_AFTER.hour ||
      (now.getHours() === LATE_AFTER.hour && now.getMinutes() > LATE_AFTER.minute);
    return db.attendance.create({
      data: { employeeId: v.id, date, checkIn: now, lat, lng, location, status: late ? "LATE" : "PRESENT" },
    });
  }

  if (!existing?.checkIn) throw new AppError("Check in first.");
  if (existing.checkOut) throw new AppError("You have already checked out today.");
  return db.attendance.update({ where: { id: existing.id }, data: { checkOut: new Date() } });
}

/** Everyone in scope with today's status. */
export async function todayBoard(v: Viewer) {
  const date = todayStr();
  const [employees, records, leaves, holidays] = await Promise.all([
    db.employee.findMany({ where: employeeScope(v), include: { branch: true }, orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { date, employee: employeeScope(v) } }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", fromDate: { lte: date }, toDate: { gte: date }, employee: employeeScope(v) },
    }),
    getHolidaySet(),
  ]);
  const byEmp = new Map(records.map((r) => [r.employeeId, r]));
  const leaveByEmp = new Map(leaves.map((l) => [l.employeeId, l]));
  const dayOff = holidays.has(date) ? "HOLIDAY" : isSunday(date) ? "WEEKLY_OFF" : null;

  return employees.map((e) => {
    const r = byEmp.get(e.id);
    const leave = leaveByEmp.get(e.id);
    const status: DayStatus = dayOff ?? (r ? (r.status as DayStatus) : leave ? "ON_LEAVE" : "NOT_IN");
    return {
      id: e.id,
      name: e.name,
      code: e.code,
      designation: e.designation,
      branch: e.branch.name,
      status,
      leaveType: leave?.type ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
      location: r?.location ?? null,
    };
  });
}

export type RegisterRow = {
  id: string;
  name: string;
  code: string;
  branch: string;
  designation: string;
  days: DayStatus[];
  present: number;
  late: number;
  leave: number;
  absent: number;
};

/** Monthly muster: one row per employee, one cell per day. */
export async function monthRegister(v: Viewer, month: string, employeeId?: string) {
  const days = daysInMonth(month);
  const today = todayStr();
  const where = employeeId ? { id: employeeId } : employeeScope(v);
  const [employees, records, leaves, holidays] = await Promise.all([
    db.employee.findMany({ where, include: { branch: true }, orderBy: [{ branchId: "asc" }, { name: "asc" }] }),
    db.attendance.findMany({ where: { date: { gte: days[0], lte: days[days.length - 1] }, employee: where } }),
    db.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        fromDate: { lte: days[days.length - 1] },
        toDate: { gte: days[0] },
        employee: where,
      },
    }),
    getHolidaySet(),
  ]);

  const rec = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r.status]));
  const rows: RegisterRow[] = employees.map((e) => {
    const myLeaves = leaves.filter((l) => l.employeeId === e.id);
    const cells = days.map<DayStatus>((d) => {
      if (holidays.has(d)) return "HOLIDAY";
      if (isSunday(d)) return "WEEKLY_OFF";
      const r = rec.get(`${e.id}|${d}`);
      if (r) return r as DayStatus;
      if (myLeaves.some((l) => l.fromDate <= d && l.toDate >= d)) return "ON_LEAVE";
      if (d > today) return "UPCOMING";
      if (d === today) return "NOT_IN";
      if (d < toDateStr(e.joinDate)) return "UPCOMING";
      return "ABSENT";
    });
    return {
      id: e.id,
      name: e.name,
      code: e.code,
      branch: e.branch.name,
      designation: e.designation,
      days: cells,
      present: cells.filter((c) => c === "PRESENT" || c === "LATE").length + cells.filter((c) => c === "HALF_DAY").length * 0.5,
      late: cells.filter((c) => c === "LATE").length,
      leave: cells.filter((c) => c === "ON_LEAVE").length,
      absent: cells.filter((c) => c === "ABSENT").length,
    };
  });
  return { days, rows, holidays: [...holidays] };
}

export async function recentLog(employeeId: string, limit = 31) {
  return db.attendance.findMany({ where: { employeeId }, orderBy: { date: "desc" }, take: limit });
}
