import { AppraisalsView } from "@/components/views/AppraisalsView";
import { addMonths, currentMonth } from "@/lib/dates";
import { listAppraisals, listCycles } from "@/services/appraisals";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Appraisals" };

export default async function AppraisalsPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const viewer = await getViewer();
  if (!can(viewer, "appraisals")) return <NoAccess module="appraisals" role={viewer.roleName} />;
  const cycles = await listCycles();
  const requested = Number((await searchParams).cycle);
  const cycle = cycles.find((c) => c.id === requested) ?? cycles.find((c) => c.status === "OPEN") ?? cycles[0] ?? null;
  const rows = cycle ? await listAppraisals(viewer, cycle.id) : [];
  const now = currentMonth();

  return (
    <AppraisalsView
      key={cycle?.id ?? 0}
      role={viewer.role}
      viewerId={viewer.id}
      cycles={cycles.map((c) => ({ id: c.id, name: c.name, fromMonth: c.fromMonth, toMonth: c.toMonth, status: c.status }))}
      cycle={cycle ? { id: cycle.id, name: cycle.name, fromMonth: cycle.fromMonth, toMonth: cycle.toMonth, status: cycle.status } : null}
      monthOptions={Array.from({ length: 12 }, (_, i) => addMonths(now, -i))}
      rows={rows.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        name: a.employee.name,
        code: a.employee.code,
        designation: a.employee.designation,
        branch: a.employee.branch.name,
        manager: a.employee.manager?.name ?? null,
        managerId: a.employee.managerId,
        targetScore: a.targetScore,
        selfRating: a.selfRating,
        selfComment: a.selfComment,
        managerRating: a.managerRating,
        managerComment: a.managerComment,
        finalRating: a.finalRating,
        incrementPct: a.incrementPct,
        hrComment: a.hrComment,
        status: a.status,
      }))}
    />
  );
}
