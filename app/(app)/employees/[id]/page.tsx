import { notFound } from "next/navigation";
import { EmployeeProfileView } from "@/components/views/EmployeeProfileView";
import { db } from "@/lib/db";
import { currentMonth, toDateStr } from "@/lib/dates";
import { monthRegister, recentLog } from "@/services/attendance";
import { getEmployee, listBranches } from "@/services/employees";
import { getBalances } from "@/services/leaves";
import { employeeTargetHistory } from "@/services/targets";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer, oid } from "@/services/viewer";

export const metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!can(viewer, "employees")) return <NoAccess module="employees" role={viewer.roleName} />;
  const emp = await getEmployee(viewer, oid(id));
  if (!emp) notFound();

  const month = currentMonth();
  const [branches, balances, targets, register, log, leaves] = await Promise.all([
    viewer.role === "HR" ? listBranches() : Promise.resolve(null),
    getBalances(emp.id),
    employeeTargetHistory(emp.id),
    monthRegister(viewer, month, emp.id),
    recentLog(emp.id, 12),
    db.leaveRequest.findMany({
      where: { employeeId: emp.id },
      include: { approver: { select: { name: true } } },
      orderBy: { fromDate: "desc" },
      take: 30,
    }),
  ]);

  return (
    <EmployeeProfileView
      showBack={viewer.role !== "EMPLOYEE"}
      data={{
        employee: {
          id: emp.id,
          code: emp.code,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          gender: emp.gender,
          designation: emp.designation,
          department: emp.department,
          branch: emp.branch.name,
          city: emp.branch.state,
          manager: emp.manager,
          joinDate: toDateStr(emp.joinDate),
          status: emp.status,
          // Salary is visible to HR and to the person themselves, not to branch managers.
          monthlyCtc: viewer.role === "HR" || viewer.id === emp.id ? emp.monthlyCtc : null,
          reportCount: emp.reports.length,
          branchId: emp.branchId,
        },
        branchList: branches ? branches.map((b) => ({ id: b.id, name: b.name })) : null,
        balances,
        targets,
        register: { days: register.days, rows: register.rows, month },
        log: log.map((l) => ({ date: l.date, checkIn: l.checkIn, checkOut: l.checkOut, location: l.location, status: l.status })),
        leaves: leaves.map((l) => ({
          id: l.id,
          type: l.type,
          fromDate: l.fromDate,
          toDate: l.toDate,
          days: l.days,
          reason: l.reason,
          status: l.status,
          approver: l.approver?.name ?? null,
        })),
      }}
    />
  );
}
