import { IncentivesView } from "@/components/views/IncentivesView";
import { addMonths, currentMonth } from "@/lib/dates";
import { getSlabs, scorecardFor, selectableMonths } from "@/services/targets";
import { NoAccess } from "@/components/ui/NoAccess";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Incentives" };

export default async function IncentivesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await getViewer();
  if (!can(viewer, "incentives")) return <NoAccess module="incentives" role={viewer.roleName} />;
  const months = selectableMonths();
  const requested = (await searchParams).month;
  // Payouts are about closed months, so open on last month by default.
  const month = requested && months.includes(requested) ? requested : addMonths(currentMonth(), -1);
  const [card, slabs] = await Promise.all([scorecardFor(viewer, month), getSlabs()]);
  const plain = (rows: typeof slabs.SALES) => rows.map((s) => ({ minPct: s.minPct, maxPct: s.maxPct, amount: s.amount }));

  return (
    <IncentivesView
      key={`${month}-${JSON.stringify(slabs)}`}
      month={month}
      months={months}
      isOpen={card.isOpen}
      rows={card.rows}
      slabs={{ SALES: plain(slabs.SALES), COLLECTION: plain(slabs.COLLECTION) }}
      role={viewer.role}
    />
  );
}
