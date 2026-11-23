import { Shell } from "@/components/shell/Shell";
import { approvalQueue } from "@/services/leaves";
import { switcherPeople } from "@/services/users";
import { can, getViewer } from "@/services/viewer";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const [queue, people] = await Promise.all([can(viewer, "leave") ? approvalQueue(viewer) : Promise.resolve([]), switcherPeople(viewer.id)]);

  return (
    <Shell
      viewer={{
        id: viewer.id,
        name: viewer.name,
        roleName: viewer.roleName,
        scope: viewer.role,
        branchName: viewer.branchName,
        modules: viewer.modules,
      }}
      people={people}
      pendingApprovals={queue.length}
    >
      {children}
    </Shell>
  );
}
