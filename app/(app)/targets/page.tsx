import { TargetsView } from "@/components/views/TargetsView";
import { currentMonth } from "@/lib/dates";
import { planEmployees, scorecardFor, selectableMonths, summariseByBranch, targetMonths } from "@/services/targets";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Targets" };

export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await getViewer();
  if (!can(viewer, "targets")) return <NoAccess module="targets" role={viewer.roleName} />;
  // HR can also open next month to plan targets ahead.
  const months = viewer.role === "HR" ? targetMonths() : selectableMonths();
  const requested = (await searchParams).month;
  const month = requested && months.includes(requested) ? requested : currentMonth();
  const [card, people] = await Promise.all([
    scorecardFor(viewer, month),
    viewer.role === "HR" ? planEmployees(viewer, month) : Promise.resolve([]),
  ]);

  return (
    <TargetsView
      key={month}
      month={month}
      months={months}
      isOpen={card.isOpen}
      progress={card.progress}
      rows={card.rows}
      branches={summariseByBranch(card.rows)}
      role={viewer.role}
      upcoming={month > currentMonth()}
      planEmployees={people}
    />
  );
}
