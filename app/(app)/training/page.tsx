import { NoAccess } from "@/components/ui/NoAccess";
import { TrainingView } from "@/components/views/TrainingView";
import { toDateStr } from "@/lib/dates";
import { AUDIENCES, listPrograms } from "@/services/training";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Training" };

export default async function TrainingPage() {
  const viewer = await getViewer();
  if (!can(viewer, "training")) return <NoAccess module="training" role={viewer.roleName} />;
  const programs = await listPrograms(viewer);
  return (
    <TrainingView
      role={viewer.role}
      viewerId={viewer.id}
      audiences={AUDIENCES}
      programs={programs.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        mandatory: p.mandatory,
        dueDate: p.dueDate,
        description: p.description,
        assignees: p.assignments.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          name: a.employee.name,
          designation: a.employee.designation,
          branch: a.employee.branch.name,
          status: a.status,
          completedOn: a.completedAt ? toDateStr(a.completedAt) : null,
          markedBy: a.markedBy,
        })),
      }))}
    />
  );
}
