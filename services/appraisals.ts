import { db } from "@/lib/db";
import { achievementPct, weightedScore } from "@/lib/scoring";
import { AppError, type Viewer } from "./viewer";

export async function listCycles() {
  return db.appraisalCycle.findMany({ orderBy: { createdAt: "desc" } });
}

/** Average monthly target score in a period, per employee on a plan. */
async function targetScores(fromMonth: string, toMonth: string) {
  const targets = await db.target.findMany({ where: { month: { gte: fromMonth, lte: toMonth } } });
  const byEmpMonth = new Map<string, typeof targets>();
  for (const t of targets) {
    const key = `${t.employeeId}|${t.month}`;
    byEmpMonth.set(key, [...(byEmpMonth.get(key) ?? []), t]);
  }
  const scores = new Map<string, number[]>();
  for (const [key, rows] of byEmpMonth) {
    const id = key.split("|")[0];
    // Skip months with nothing recorded yet so an unstarted month doesn't drag the average down.
    if (rows.every((r) => achievementPct(r.target, r.achieved) === 0)) continue;
    scores.set(id, [...(scores.get(id) ?? []), weightedScore(rows)]);
  }
  return new Map([...scores].map(([id, xs]) => [id, xs.reduce((a, b) => a + b, 0) / xs.length]));
}

export async function startCycle(v: Viewer, input: { name: string; fromMonth: string; toMonth: string }) {
  if (v.role !== "HR") throw new AppError("Only HR can start an appraisal cycle.", 403);
  if (!input.name?.trim()) throw new AppError("Give the cycle a name.");
  const re = /^\d{4}-\d{2}$/;
  if (!re.test(input.fromMonth ?? "") || !re.test(input.toMonth ?? "")) throw new AppError("Choose the review period.");
  if (input.toMonth < input.fromMonth) throw new AppError("The period ends before it starts.");
  if (await db.appraisalCycle.findFirst({ where: { status: "OPEN" } })) throw new AppError("Close the current cycle before starting a new one.");

  const [employees, scores] = await Promise.all([
    // The HR head has nobody above them in the system, so they are reviewed outside it.
    db.employee.findMany({ where: { status: "ACTIVE", NOT: { accessRole: "HR", managerId: null } } }),
    targetScores(input.fromMonth, input.toMonth),
  ]);
  return db.appraisalCycle.create({
    data: {
      name: input.name.trim(),
      fromMonth: input.fromMonth,
      toMonth: input.toMonth,
      appraisals: { create: employees.map((e) => ({ employeeId: e.id, targetScore: scores.get(e.id) ?? null })) },
    },
  });
}

export async function closeCycle(v: Viewer, id: string) {
  if (v.role !== "HR") throw new AppError("Only HR can close a cycle.", 403);
  const open = await db.appraisal.count({ where: { cycleId: id, status: { not: "DONE" } } });
  if (open) throw new AppError(`${open} review${open === 1 ? " is" : "s are"} not finalised yet.`);
  return db.appraisalCycle.update({ where: { id }, data: { status: "CLOSED" } });
}

export async function listAppraisals(v: Viewer, cycleId: string) {
  return db.appraisal.findMany({
    where: {
      cycleId,
      // A manager reviews direct reports and also sees their own review.
      employee: v.role === "HR" ? {} : v.role === "MANAGER" ? { OR: [{ managerId: v.id }, { id: v.id }] } : { id: v.id },
    },
    include: { employee: { include: { branch: true, manager: { select: { name: true } } } } },
    orderBy: { employee: { name: "asc" } },
  });
}

function rating(n: unknown) {
  const r = Number(n);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new AppError("Choose a rating from 1 to 5.");
  return r;
}

export async function submitStep(
  v: Viewer,
  id: string,
  input: { rating: unknown; comment?: string; incrementPct?: unknown },
) {
  const a = await db.appraisal.findUnique({ where: { id }, include: { employee: true, cycle: true } });
  if (!a) throw new AppError("Review not found.", 404);
  if (a.cycle.status !== "OPEN") throw new AppError("This cycle is closed.");
  const comment = input.comment?.trim() || null;

  if (a.status === "SELF") {
    if (a.employeeId !== v.id) throw new AppError(`Waiting for ${a.employee.name}'s self review.`, 403);
    if (!comment) throw new AppError("Write a few lines about your half-year.");
    // No manager on record → straight to HR.
    return db.appraisal.update({
      where: { id },
      data: { selfRating: rating(input.rating), selfComment: comment, status: a.employee.managerId ? "MANAGER" : "HR" },
    });
  }
  if (a.status === "MANAGER") {
    if (a.employee.managerId !== v.id) throw new AppError("Only the reporting manager can do this review.", 403);
    if (!comment) throw new AppError("Add your comments for the employee.");
    return db.appraisal.update({ where: { id }, data: { managerRating: rating(input.rating), managerComment: comment, status: "HR" } });
  }
  if (a.status === "HR") {
    if (v.role !== "HR") throw new AppError("Only HR can finalise a review.", 403);
    if (a.employeeId === v.id) throw new AppError("You can't finalise your own review.", 403);
    const inc = Number(input.incrementPct ?? 0);
    if (!Number.isFinite(inc) || inc < 0 || inc > 50) throw new AppError("Increment must be between 0% and 50%.");
    return db.appraisal.update({
      where: { id },
      data: { finalRating: rating(input.rating), incrementPct: inc, hrComment: comment, status: "DONE" },
    });
  }
  throw new AppError("This review is already finalised.");
}
