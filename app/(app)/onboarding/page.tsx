import { OnboardingView } from "@/components/views/OnboardingView";
import { toDateStr } from "@/lib/dates";
import { eligibleEmployees, listCases } from "@/services/checklists";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!can(viewer, "onboarding")) return <NoAccess module="onboarding" role={viewer.roleName} />;
  const [cases, employees] = await Promise.all([listCases(viewer), eligibleEmployees(viewer)]);
  return (
    <OnboardingView
      role={viewer.role}
      employees={employees}
      cases={cases.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        name: c.employee.name,
        code: c.employee.code,
        designation: c.employee.designation,
        branch: c.employee.branch.name,
        kind: c.kind,
        startedOn: toDateStr(c.startedAt),
        tasks: c.tasks.map((t) => ({ id: t.id, title: t.title, owner: t.owner, done: t.done, doneBy: t.doneBy, doneAt: t.doneAt })),
      }))}
    />
  );
}
