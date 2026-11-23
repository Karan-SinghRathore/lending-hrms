import { NoAccess } from "@/components/ui/NoAccess";
import { RecruitmentView } from "@/components/views/RecruitmentView";
import { toDateStr } from "@/lib/dates";
import { listBranches } from "@/services/employees";
import { listJobs } from "@/services/recruitment";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Recruitment" };

export default async function RecruitmentPage() {
  const viewer = await getViewer();
  if (!can(viewer, "recruitment") || viewer.role === "EMPLOYEE") return <NoAccess module="recruitment" role={viewer.roleName} />;
  const [jobs, branches] = await Promise.all([listJobs(viewer), listBranches()]);
  return (
    <RecruitmentView
      role={viewer.role}
      canAddEmployee={can(viewer, "employees")}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      jobs={jobs.map((j) => ({
        id: j.id,
        title: j.title,
        branchId: j.branchId,
        branch: j.branch.name,
        openings: j.openings,
        status: j.status,
        openedOn: toDateStr(j.createdAt),
        candidates: j.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          source: c.source,
          stage: c.stage,
          expectedCtc: c.expectedCtc,
          notes: c.notes,
          employeeId: c.employeeId,
          addedOn: toDateStr(c.createdAt),
        })),
      }))}
    />
  );
}
