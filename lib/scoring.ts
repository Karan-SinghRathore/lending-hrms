import { SCORE_CAP_PCT } from "./config";

export type MetricRow = { target: number; achieved: number; weight: number };
export type Slab = { minPct: number; maxPct: number | null; amount: number };

export function achievementPct(target: number, achieved: number): number {
  if (target <= 0) return 0;
  return (achieved / target) * 100;
}

/** Weighted achievement score; each metric is capped so one outlier can't carry the score. */
export function weightedScore(rows: MetricRow[]): number {
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = rows.reduce(
    (s, r) => s + r.weight * Math.min(achievementPct(r.target, r.achieved), SCORE_CAP_PCT),
    0,
  );
  return sum / totalWeight;
}

export function slabFor(score: number, slabs: Slab[]): Slab | null {
  return (
    slabs.find((s) => score >= s.minPct && (s.maxPct === null || score < s.maxPct)) ?? null
  );
}

export type Standing = "ON_TRACK" | "AT_RISK" | "BEHIND";

/** Projected score ≥ 100 → on track, 85–100 → at risk, below 85 → behind. */
export function standing(projectedScore: number): Standing {
  if (projectedScore >= 100) return "ON_TRACK";
  if (projectedScore >= 85) return "AT_RISK";
  return "BEHIND";
}
