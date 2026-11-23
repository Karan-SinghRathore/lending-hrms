import { db } from "@/lib/db";
import { AppError, type Viewer } from "./viewer";

export async function getHolidays() {
  return db.holiday.findMany({ orderBy: { date: "asc" } });
}

export async function getHolidaySet(): Promise<Set<string>> {
  const rows = await db.holiday.findMany({ select: { date: true } });
  return new Set(rows.map((r) => r.date));
}

export async function addHoliday(v: Viewer, input: { date: string; name: string }) {
  if (v.role !== "HR") throw new AppError("Only HR can change the holiday calendar.", 403);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) throw new AppError("Choose a date.");
  if (!input.name?.trim()) throw new AppError("Enter the holiday name.");
  if (await db.holiday.findUnique({ where: { date: input.date } })) throw new AppError("There is already a holiday on that date.");
  return db.holiday.create({ data: { date: input.date, name: input.name.trim() } });
}

export async function removeHoliday(v: Viewer, id: number) {
  if (v.role !== "HR") throw new AppError("Only HR can change the holiday calendar.", 403);
  const h = await db.holiday.findUnique({ where: { id } });
  if (!h) throw new AppError("Holiday not found.", 404);
  return db.holiday.delete({ where: { id } });
}
