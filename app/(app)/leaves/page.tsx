import { LeavesView, type LeaveRow } from "@/components/views/LeavesView";
import { toDateStr } from "@/lib/dates";
import { getHolidays } from "@/services/holidays";
import { approvalQueue, getBalances, listRequests } from "@/services/leaves";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Leave" };

type Request = Awaited<ReturnType<typeof listRequests>>[number];

const toRow = (r: Request): LeaveRow => ({
  id: r.id,
  employeeId: r.employeeId,
  name: r.employee.name,
  code: r.employee.code,
  branch: r.employee.branch.name,
  designation: r.employee.designation,
  type: r.type,
  fromDate: r.fromDate,
  toDate: r.toDate,
  halfDay: r.halfDay,
  days: r.days,
  reason: r.reason,
  status: r.status,
  approver: r.approver?.name ?? null,
  remark: r.remark,
  appliedOn: toDateStr(r.createdAt),
});

export default async function LeavesPage() {
  const viewer = await getViewer();
  if (!can(viewer, "leave")) return <NoAccess module="leave" role={viewer.roleName} />;
  const [balances, mine, queue, all, holidays] = await Promise.all([
    getBalances(viewer.id),
    listRequests(viewer, { mine: true }),
    approvalQueue(viewer),
    viewer.role === "EMPLOYEE" ? Promise.resolve([]) : listRequests(viewer),
    getHolidays(),
  ]);
  return (
    <LeavesView
      role={viewer.role}
      balances={balances}
      mine={mine.map(toRow)}
      queue={queue.map(toRow)}
      all={all.map(toRow)}
      holidays={holidays.map((h) => ({ id: h.id, date: h.date, name: h.name }))}
    />
  );
}
