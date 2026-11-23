import { MyDashboard, TeamDashboard } from "@/components/views/DashboardView";
import { COMPANY_NAME } from "@/lib/config";
import { myDashboard, teamDashboard } from "@/services/dashboard";
import { getViewer } from "@/services/viewer";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (viewer.role === "EMPLOYEE") {
    const data = await myDashboard(viewer);
    return (
      <MyDashboard
        data={data}
        name={viewer.name}
        subtitle={`${viewer.designation} · ${viewer.branchName} branch · ${viewer.code}`}
      />
    );
  }
  const data = await teamDashboard(viewer);
  return (
    <TeamDashboard
      data={data}
      isHr={viewer.role === "HR"}
      scopeLabel={viewer.role === "HR" ? COMPANY_NAME : `${viewer.branchName} branch`}
    />
  );
}
