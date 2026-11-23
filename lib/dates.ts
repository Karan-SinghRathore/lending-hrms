// All dates are local calendar dates as "YYYY-MM-DD" and months as "YYYY-MM".
// Working week: Monday–Saturday (branches work Saturdays), Sunday off.

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function currentMonth(): string {
  return todayStr().slice(0, 7);
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

export function isSunday(s: string): boolean {
  return parseDate(s).getDay() === 0;
}

export function isWorkingDay(s: string, holidays: Set<string>): boolean {
  return !isSunday(s) && !holidays.has(s);
}

export function workingDaysBetween(from: string, to: string, holidays: Set<string>): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isWorkingDay(d, holidays)) out.push(d);
  }
  return out;
}

export function monthWorkingDays(month: string, holidays: Set<string>): string[] {
  return daysInMonth(month).filter((d) => isWorkingDay(d, holidays));
}

/** Share of the month's working days already done (1 for past months, 0 for future). */
export function monthProgress(month: string, holidays: Set<string>, today = todayStr()): number {
  const all = monthWorkingDays(month, holidays);
  if (all.length === 0) return 1;
  const done = all.filter((d) => d <= today).length;
  return done / all.length;
}

export function monthLabel(month: string): string {
  return parseDate(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function shortDate(s: string): string {
  return parseDate(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function longDate(s: string): string {
  return parseDate(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function weekday(s: string): string {
  return parseDate(s).toLocaleDateString("en-IN", { weekday: "short" });
}

export function timeOf(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
