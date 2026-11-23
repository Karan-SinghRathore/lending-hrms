import { AttendanceView } from "@/components/views/AttendanceView";
import { db } from "@/lib/db";
import { isSunday, todayStr } from "@/lib/dates";
import { getToday, monthRegister, todayBoard } from "@/services/attendance";
import { getHolidaySet } from "@/services/holidays";
import { selectableMonths } from "@/services/targets";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await getViewer();
  if (!can(viewer, "attendance")) return <NoAccess module="attendance" role={viewer.roleName} />;
  const months = selectableMonths().slice(0, 2); // attendance is kept for this month and last
  const requested = (await searchParams).month;
  const month = requested && months.includes(requested) ? requested : months[0];
  const today = todayStr();

  const [myToday, holidays, board, register, myLog] = await Promise.all([
    getToday(viewer.id),
    getHolidaySet(),
    viewer.role === "EMPLOYEE" ? Promise.resolve([]) : todayBoard(viewer),
    monthRegister(viewer, month),
    viewer.role === "EMPLOYEE"
      ? db.attendance.findMany({ where: { employeeId: viewer.id, date: { startsWith: month } }, orderBy: { date: "desc" } })
      : Promise.resolve([]),
  ]);
  const dayOff = holidays.has(today) ? "HOLIDAY" : isSunday(today) ? "WEEKLY_OFF" : null;

  return (
    <AttendanceView
      role={viewer.role}
      myToday={myToday ? { checkIn: myToday.checkIn, checkOut: myToday.checkOut, location: myToday.location, status: myToday.status } : null}
      dayOff={dayOff}
      board={board}
      register={{ days: register.days, rows: register.rows }}
      month={month}
      months={months}
      myLog={myLog.map((l) => ({ date: l.date, checkIn: l.checkIn, checkOut: l.checkOut, location: l.location, status: l.status }))}
    />
  );
}
