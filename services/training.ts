import { db } from "@/lib/db";
import { TRAINING_CATEGORIES } from "@/lib/config";
import { AppError, canSee, type Viewer } from "./viewer";

export const AUDIENCES: Record<string, string> = {
  ALL: "Everyone",
  SALES: "Relationship Officers",
  COLLECTION: "Collection Officers",
  MANAGERS: "Branch Managers",
};

/** Programmes with the assignments this viewer may see (company / branch / self). */
export async function listPrograms(v: Viewer) {
  const employee = v.role === "HR" ? {} : v.role === "MANAGER" ? { branchId: v.branchId } : { id: v.id };
  const programs = await db.trainingProgram.findMany({
    include: {
      assignments: { where: { employee }, include: { employee: { select: { name: true, code: true, designation: true, branch: { select: { name: true } } } } }, orderBy: { employee: { name: "asc" } } },
    },
    orderBy: { createdAt: "desc" },
  });
  // People outside HR only see programmes that involve them or their branch.
  return v.role === "HR" ? programs : programs.filter((p) => p.assignments.length);
}

export async function createProgram(
  v: Viewer,
  input: { title: string; category: string; mandatory: boolean; dueDate?: string | null; description?: string; audience: string },
) {
  if (v.role !== "HR") throw new AppError("Only HR can create a training.", 403);
  const title = input.title?.trim();
  if (!title) throw new AppError("Give the training a title.");
  if (!TRAINING_CATEGORIES.includes(input.category)) throw new AppError("Choose a category.");
  if (!AUDIENCES[input.audience]) throw new AppError("Choose who should attend.");
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new AppError("Choose a valid due date.");

  const where =
    input.audience === "ALL" ? {} : input.audience === "MANAGERS" ? { designation: "Branch Manager" } : { plan: input.audience };
  const people = await db.employee.findMany({ where: { status: "ACTIVE", ...where }, select: { id: true } });
  if (!people.length) throw new AppError("Nobody matches that audience.");
  return db.trainingProgram.create({
    data: {
      title,
      category: input.category,
      mandatory: Boolean(input.mandatory),
      dueDate: input.dueDate || null,
      description: input.description?.trim() || null,
      assignments: { create: people.map((p) => ({ employeeId: p.id })) },
    },
  });
}

export async function deleteProgram(v: Viewer, id: number) {
  if (v.role !== "HR") throw new AppError("Only HR can remove a training.", 403);
  return db.trainingProgram.delete({ where: { id } });
}

export async function markAssignment(v: Viewer, id: number, done: boolean) {
  const a = await db.trainingAssignment.findUnique({ where: { id }, include: { employee: true } });
  if (!a) throw new AppError("Training record not found.", 404);
  if (!canSee(v, a.employee)) throw new AppError("This training record is not yours to update.", 403);
  // Once marked, only a manager or HR can undo it.
  if (!done && v.role === "EMPLOYEE") throw new AppError("Ask your manager or HR to reopen a completed training.", 403);
  return db.trainingAssignment.update({
    where: { id },
    data: { status: done ? "COMPLETED" : "ASSIGNED", completedAt: done ? new Date() : null, markedBy: done ? v.name : null },
  });
}
