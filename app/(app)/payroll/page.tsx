import { PayrollView, type SlipRow } from "@/components/views/PayrollView";
import { listPayslips, payrollMonths } from "@/services/payroll";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await getViewer();
  if (!can(viewer, "payroll")) return <NoAccess module="payroll" role={viewer.roleName} />;
  const months = payrollMonths();
  const requested = (await searchParams).month;
  const month = requested && months.includes(requested) ? requested : months[0];
  const slips = await listPayslips(viewer, month);

  const rows: SlipRow[] = slips.map((s) => ({
    id: s.id,
    month: s.month,
    name: s.employee.name,
    code: s.employee.code,
    designation: s.employee.designation,
    branch: s.employee.branch.name,
    workingDays: s.workingDays,
    paidDays: s.paidDays,
    lopDays: s.lopDays,
    basic: s.basic,
    hra: s.hra,
    allowance: s.allowance,
    incentive: s.incentive,
    lopAmount: s.lopAmount,
    gross: s.gross,
    pf: s.pf,
    esi: s.esi,
    pt: s.pt,
    tds: s.tds,
    net: s.net,
    status: s.status,
  }));

  return <PayrollView key={month} role={viewer.role} month={month} months={months} slips={rows} />;
}
