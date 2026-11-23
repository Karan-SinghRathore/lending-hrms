import { redirect } from "next/navigation";
import { EmployeesView } from "@/components/views/EmployeesView";
import { toDateStr } from "@/lib/dates";
import { listBranches, listEmployees } from "@/services/employees";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const viewer = await getViewer();
  if (!can(viewer, "employees")) return <NoAccess module="employees" role={viewer.roleName} />;
  if (viewer.role === "EMPLOYEE") redirect(`/employees/${viewer.id}`);
  const [employees, branches] = await Promise.all([listEmployees(viewer), listBranches()]);
  return (
    <EmployeesView
      showBranchFilter={viewer.role === "HR"}
      canManage={viewer.role === "HR"}
      branchList={branches.map((b) => ({ id: b.id, name: b.name }))}
      rows={employees.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        department: e.department,
        branch: e.branch.name,
        manager: e.manager?.name ?? null,
        joinDate: toDateStr(e.joinDate),
        status: e.status,
      }))}
    />
  );
}
