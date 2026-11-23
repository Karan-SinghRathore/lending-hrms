import { db } from "@/lib/db";
import { PLANS, type Plan } from "@/lib/config";
import { AppError, type Viewer } from "./viewer";

export { getSlabs } from "./targets";

export async function saveSlabs(
  v: Viewer,
  plan: string,
  slabs: { minPct: number; maxPct: number | null; amount: number }[],
) {
  if (v.role !== "HR") throw new AppError("Only HR can change incentive slabs.", 403);
  if (!PLANS[plan as Plan]) throw new AppError("Unknown plan.");
  if (!slabs.length) throw new AppError("Add at least one slab.");

  const sorted = [...slabs].sort((a, b) => a.minPct - b.minPct);
  sorted.forEach((s, i) => {
    if (!Number.isFinite(s.minPct) || s.minPct < 0) throw new AppError(`Row ${i + 1}: "from" must be 0 or more.`);
    if (!Number.isFinite(s.amount) || s.amount < 0) throw new AppError(`Row ${i + 1}: payout must be 0 or more.`);
    if (s.maxPct !== null && s.maxPct <= s.minPct) throw new AppError(`Row ${i + 1}: "up to" must be above "from".`);
    const next = sorted[i + 1];
    if (next) {
      if (s.maxPct === null) throw new AppError(`Row ${i + 1}: only the last slab can be open-ended.`);
      if (next.minPct !== s.maxPct) throw new AppError(`Slabs must join up: row ${i + 1} ends at ${s.maxPct}%, next starts at ${next.minPct}%.`);
    }
  });

  await db.$transaction([
    db.incentiveSlab.deleteMany({ where: { plan } }),
    db.incentiveSlab.createMany({
      data: sorted.map((s) => ({ plan, minPct: s.minPct, maxPct: s.maxPct, amount: Math.round(s.amount) })),
    }),
  ]);
}
