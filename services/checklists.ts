import { db } from "@/lib/db";
import { CHECKLISTS } from "@/lib/config";
import { AppError, canSee, employeeScope, type Viewer } from "./viewer";

export async function listCases(v: Viewer) {
  return db.checklistCase.findMany({
    // Exits can involve people who are no longer active, so scope by branch / self rather than status.
    where: { employee: v.role === "HR" ? {} : v.role === "MANAGER" ? { branchId: v.branchId } : { id: v.id } },
    include: { employee: { include: { branch: true } }, tasks: { orderBy: { sort: "asc" } } },
    orderBy: { startedAt: "desc" },
  });
}

export async function startCase(v: Viewer, employeeId: number, kind: string) {
  if (v.role !== "HR") throw new AppError("Only HR can start a checklist.", 403);
  if (kind !== "JOINING" && kind !== "EXIT") throw new AppError("Choose joining or exit.");
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("Choose an employee.");
  const open = await db.checklistCase.findFirst({ where: { employeeId, kind, tasks: { some: { done: false } } } });
  if (open) throw new AppError(`${emp.name} already has an open ${kind.toLowerCase()} checklist.`);
  return db.checklistCase.create({
    data: { employeeId, kind, tasks: { create: CHECKLISTS[kind].map((t, i) => ({ ...t, sort: i })) } },
  });
}

export async function toggleTask(v: Viewer, taskId: number, done: boolean) {
  const task = await db.checklistTask.findUnique({ where: { id: taskId }, include: { case: { include: { employee: true } } } });
  if (!task) throw new AppError("Task not found.", 404);
  if (!canSee(v, task.case.employee)) throw new AppError("This checklist is not yours to update.", 403);
  // An employee ticks only their own items; managers and HR can tick anything they can see.
  if (v.role === "EMPLOYEE" && task.owner !== "EMPLOYEE") throw new AppError(`This step is completed by ${task.owner === "HR" ? "HR" : "your manager"}.`, 403);
  return db.checklistTask.update({
    where: { id: taskId },
    data: { done, doneBy: done ? v.name : null, doneAt: done ? new Date() : null },
  });
}

export async function eligibleEmployees(v: Viewer) {
  if (v.role !== "HR") return [];
  const rows = await db.employee.findMany({ where: employeeScope(v), include: { branch: true }, orderBy: { name: "asc" } });
  return rows.map((e) => ({ id: e.id, name: e.name, code: e.code, branch: e.branch.name }));
}
