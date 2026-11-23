import { db } from "@/lib/db";
import { METRICS, METRIC_WEIGHT, PLANS, type Metric, type Plan } from "@/lib/config";
import { addMonths, currentMonth, monthProgress } from "@/lib/dates";
import { achievementPct, slabFor, standing, weightedScore, type Slab, type Standing } from "@/lib/scoring";
import { getHolidaySet } from "./holidays";
import { AppError, employeeScope, type Viewer } from "./viewer";

export type MetricCell = {
  targetId: number;
  metric: Metric;
  label: string;
  unit: "inr" | "count";
  target: number;
  achieved: number;
  weight: number;
  pct: number;
};

export type ScoreRow = {
  employeeId: number;
  name: string;
  code: string;
  designation: string;
  branch: string;
  branchId: number;
  plan: Plan;
  metrics: MetricCell[];
  score: number; // achievement so far
  projected: number; // score at current pace by month end (= score for closed months)
  standing: Standing;
  slab: Slab | null;
  incentive: number;
  rank: number;
};

export function selectableMonths(): string[] {
  const now = currentMonth();
  return [now, addMonths(now, -1), addMonths(now, -2)];
}

export async function getSlabs() {
  const rows = await db.incentiveSlab.findMany({ orderBy: [{ plan: "asc" }, { minPct: "asc" }] });
  return {
    SALES: rows.filter((r) => r.plan === "SALES"),
    COLLECTION: rows.filter((r) => r.plan === "COLLECTION"),
  } as Record<Plan, typeof rows>;
}

export async function scorecard(v: Viewer, month: string) {
  const holidays = await getHolidaySet();
  const progress = monthProgress(month, holidays);
  const isOpen = month === currentMonth();
  const [employees, slabs] = await Promise.all([
    db.employee.findMany({
      where: { ...employeeScope(v), plan: { in: ["SALES", "COLLECTION"] } },
      include: { branch: true, targets: { where: { month } } },
      orderBy: { name: "asc" },
    }),
    getSlabs(),
  ]);

  const rows: ScoreRow[] = employees
    .filter((e) => e.targets.length > 0)
    .map((e) => {
      const plan = e.plan as Plan;
      const metrics = e.targets
        .map<MetricCell>((t) => ({
          targetId: t.id,
          metric: t.metric as Metric,
          label: METRICS[t.metric as Metric].label,
          unit: METRICS[t.metric as Metric].unit,
          target: t.target,
          achieved: t.achieved,
          weight: t.weight,
          pct: achievementPct(t.target, t.achieved),
        }))
        .sort((a, b) => b.weight - a.weight);
      const score = weightedScore(metrics);
      const projected = isOpen && progress > 0 ? weightedScore(metrics.map((m) => ({ ...m, achieved: m.achieved / progress }))) : score;
      const slab = slabFor(projected, slabs[plan]);
      return {
        employeeId: e.id,
        name: e.name,
        code: e.code,
        designation: e.designation,
        branch: e.branch.name,
        branchId: e.branchId,
        plan,
        metrics,
        score,
        projected,
        standing: standing(projected),
        slab,
        incentive: slab?.amount ?? 0,
        rank: 0,
      };
    })
    .sort((a, b) => b.projected - a.projected);
  rows.forEach((r, i) => (r.rank = i + 1));

  return { month, isOpen, progress, rows };
}

/**
 * Scorecard for the viewer's own screens. An employee gets only their own row,
 * but ranked against everyone on the same plan company-wide.
 */
export async function scorecardFor(v: Viewer, month: string) {
  const card = await scorecard(v, month);
  if (v.role !== "EMPLOYEE" || !card.rows[0]) return card;
  const everyone = await scorecard({ ...v, role: "HR" }, month);
  const peers = everyone.rows.filter((r) => r.plan === card.rows[0].plan);
  const rank = peers.findIndex((r) => r.employeeId === v.id) + 1;
  return { ...card, rows: [{ ...card.rows[0], rank }], peerCount: peers.length };
}

export type BranchSummary = {
  branchId: number;
  branch: string;
  disbursalTarget: number;
  disbursalAchieved: number;
  collectionTarget: number;
  collectionAchieved: number;
  avgScore: number;
  onTrack: number;
  people: number;
  incentive: number;
};

export function summariseByBranch(rows: ScoreRow[]): BranchSummary[] {
  const map = new Map<number, BranchSummary>();
  for (const r of rows) {
    const b =
      map.get(r.branchId) ??
      ({
        branchId: r.branchId,
        branch: r.branch,
        disbursalTarget: 0,
        disbursalAchieved: 0,
        collectionTarget: 0,
        collectionAchieved: 0,
        avgScore: 0,
        onTrack: 0,
        people: 0,
        incentive: 0,
      } satisfies BranchSummary);
    for (const m of r.metrics) {
      if (m.metric === "DISBURSAL") {
        b.disbursalTarget += m.target;
        b.disbursalAchieved += m.achieved;
      }
      if (m.metric === "COLLECTION") {
        b.collectionTarget += m.target;
        b.collectionAchieved += m.achieved;
      }
    }
    b.avgScore += r.projected;
    b.people += 1;
    b.incentive += r.incentive;
    if (r.standing === "ON_TRACK") b.onTrack += 1;
    map.set(r.branchId, b);
  }
  return [...map.values()]
    .map((b) => ({ ...b, avgScore: b.people ? b.avgScore / b.people : 0 }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

export async function updateTarget(v: Viewer, id: number, input: { achieved?: number; target?: number }) {
  const t = await db.target.findUnique({ where: { id }, include: { employee: true } });
  if (!t) throw new AppError("Target not found.", 404);
  if (v.role === "EMPLOYEE") throw new AppError("Only your manager or HR can update achievement.", 403);
  if (v.role === "MANAGER" && t.employee.branchId !== v.branchId) throw new AppError("You can only update people in your own branch.", 403);
  if (input.target !== undefined && v.role !== "HR") throw new AppError("Only HR can change a target.", 403);

  const data: { achieved?: number; target?: number } = {};
  if (input.achieved !== undefined) {
    if (!Number.isFinite(input.achieved) || input.achieved < 0) throw new AppError("Achieved must be 0 or more.");
    data.achieved = input.achieved;
  }
  if (input.target !== undefined) {
    if (!Number.isFinite(input.target) || input.target <= 0) throw new AppError("Target must be more than 0.");
    data.target = input.target;
  }
  return db.target.update({ where: { id }, data });
}

export async function employeeTargetHistory(employeeId: number) {
  const months = selectableMonths();
  const holidays = await getHolidaySet();
  const targets = await db.target.findMany({ where: { employeeId, month: { in: months } } });
  return months
    .map((month) => {
      const ts = targets.filter((t) => t.month === month);
      if (!ts.length) return null;
      const metrics = ts.map((t) => ({
        metric: t.metric as Metric,
        label: METRICS[t.metric as Metric].label,
        unit: METRICS[t.metric as Metric].unit,
        target: t.target,
        achieved: t.achieved,
        weight: t.weight,
        pct: achievementPct(t.target, t.achieved),
      }));
      return { month, progress: monthProgress(month, holidays), score: weightedScore(metrics), metrics };
    })
    .filter((x) => x !== null);
}

/** Months HR can plan: next month, this month and the two before. */
export function targetMonths(): string[] {
  return [addMonths(currentMonth(), 1), ...selectableMonths()];
}

/** People on an incentive plan, with whether they already have targets for the month. */
export async function planEmployees(v: Viewer, month: string) {
  const rows = await db.employee.findMany({
    where: { ...employeeScope(v), plan: { in: ["SALES", "COLLECTION"] } },
    include: { branch: true, targets: { where: { month }, select: { id: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((e) => ({ id: e.id, name: e.name, code: e.code, branch: e.branch.name, plan: e.plan as Plan, hasTargets: e.targets.length > 0 }));
}

/** HR sets (or replaces) one person's targets for a month. */
export async function setTargets(
  v: Viewer,
  input: { employeeId: number; month: string; values: Record<string, number> },
) {
  if (v.role !== "HR") throw new AppError("Only HR can set targets.", 403);
  if (!targetMonths().includes(input.month)) throw new AppError("Targets can be set for next month, this month or the last two months.");
  const emp = await db.employee.findUnique({ where: { id: input.employeeId } });
  if (!emp || emp.status !== "ACTIVE") throw new AppError("Choose an employee.");
  if (emp.plan !== "SALES" && emp.plan !== "COLLECTION") throw new AppError(`${emp.name} is not on an incentive plan.`);

  const metrics = PLANS[emp.plan as Plan].metrics;
  for (const metric of metrics) {
    const target = Number(input.values[metric]);
    if (!Number.isFinite(target) || target <= 0) throw new AppError(`Enter a target for ${METRICS[metric].label.toLowerCase()}.`);
  }
  await db.$transaction(
    metrics.map((metric) =>
      db.target.upsert({
        where: { employeeId_month_metric: { employeeId: emp.id, month: input.month, metric } },
        create: { employeeId: emp.id, month: input.month, metric, target: Number(input.values[metric]), achieved: 0, weight: METRIC_WEIGHT[metric] },
        update: { target: Number(input.values[metric]) },
      }),
    ),
  );
  return { employee: emp.name };
}

export async function deleteTargets(v: Viewer, employeeId: number, month: string) {
  if (v.role !== "HR") throw new AppError("Only HR can remove targets.", 403);
  const res = await db.target.deleteMany({ where: { employeeId, month } });
  if (!res.count) throw new AppError("No targets found to remove.", 404);
  return { removed: res.count };
}
