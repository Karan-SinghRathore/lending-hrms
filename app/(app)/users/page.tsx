import { NoAccess } from "@/components/ui/NoAccess";
import { UsersView } from "@/components/views/UsersView";
import { listRoles, listUsers } from "@/services/users";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const viewer = await getViewer();
  if (!can(viewer, "users")) return <NoAccess module="users" role={viewer.roleName} />;
  const [roles, users] = await Promise.all([listRoles(), listUsers()]);
  return <UsersView key={JSON.stringify(roles.map((r) => r.modules))} roles={roles} users={users} viewerId={viewer.id} />;
}
