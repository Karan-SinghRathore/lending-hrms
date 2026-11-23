import { db } from "@/lib/db";
import { CHECKLISTS, DESIGNATIONS, LEAVE_TYPES } from "@/lib/config";
import { parseDate, todayStr } from "@/lib/dates";
import { AppError, canSee, employeeScope, type Viewer } from "./viewer";

export async function listEmployees(v: Viewer) {
  return db.employee.findMany({
    where: employeeScope(v),
    include: { branch: true, manager: { select: { name: true } } },
    orderBy: [{ branchId: "asc" }, { name: "asc" }],
  });
}

export async function getEmployee(v: Viewer, id: number) {
  const emp = await db.employee.findUnique({
    where: { id },
    include: { branch: true, manager: { select: { id: true, name: true, designation: true } }, reports: { select: { id: true } } },
  });
  if (!emp || !canSee(v, emp)) return null;
  return emp;
}

export async function listBranches() {
  return db.branch.findMany({ orderBy: { name: "asc" } });
}

export type EmployeeInput = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  designation: string;
  branchId: number;
  joinDate: string;
  monthlyCtc: number;
  status?: string;
};

async function validate(input: EmployeeInput, selfId?: number) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = String(input.phone ?? "").replace(/\D/g, "");
  if (!name || name.length < 3) throw new AppError("Enter the employee's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "")) throw new AppError("Enter a valid email address.");
  if (phone.length !== 10) throw new AppError("Phone number must be 10 digits.");
  const preset = DESIGNATIONS[input.designation];
  if (!preset) throw new AppError("Choose a designation.");
  const branch = await db.branch.findUnique({ where: { id: Number(input.branchId) } });
  if (!branch) throw new AppError("Choose a branch.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.joinDate ?? "")) throw new AppError("Choose the date of joining.");
  const ctc = Number(input.monthlyCtc);
  if (!Number.isFinite(ctc) || ctc < 5000) throw new AppError("Monthly CTC must be at least ₹5,000.");
  const clash = await db.employee.findUnique({ where: { email } });
  if (clash && clash.id !== selfId) throw new AppError(`${email} is already used by ${clash.name}.`);
  return { name, email, phone, preset, branch, ctc };
}

async function branchManagerId(branchId: number, exceptId?: number) {
  const bm = await db.employee.findFirst({
    where: { branchId, designation: "Branch Manager", status: "ACTIVE", id: exceptId ? { not: exceptId } : undefined },
  });
  return bm?.id ?? null;
}

export async function createEmployee(v: Viewer, input: EmployeeInput) {
  if (v.role !== "HR") throw new AppError("Only HR can add employees.", 403);
  const { name, email, phone, preset, branch, ctc } = await validate(input);
  const nextNo = Math.max(1000, ...(await db.employee.findMany({ select: { code: true } })).map((e) => Number(e.code.split("-")[1]) || 0)) + 1;
  const year = Number(todayStr().slice(0, 4));
  // New people start on the standard role for their kind of job; HR can change it under Users & roles.
  const defaultRole = await db.role.findFirst({ where: { base: preset.accessRole }, orderBy: [{ locked: "asc" }, { id: "asc" }] });

  const emp = await db.employee.create({
    data: {
      code: `EMP-${nextNo}`,
      name,
      email,
      phone,
      gender: input.gender === "F" ? "F" : "M",
      designation: input.designation,
      department: preset.department,
      accessRole: defaultRole?.base ?? preset.accessRole,
      roleId: defaultRole?.id,
      plan: preset.plan,
      joinDate: parseDate(input.joinDate),
      monthlyCtc: Math.round(ctc),
      branchId: branch.id,
      managerId: preset.accessRole === "MANAGER" ? null : await branchManagerId(branch.id),
      leaveAllocations: {
        create: (Object.keys(LEAVE_TYPES) as (keyof typeof LEAVE_TYPES)[]).map((type) => ({ year, type, allocated: LEAVE_TYPES[type].annual })),
      },
      // Every new joiner starts with the joining checklist.
      checklists: { create: { kind: "JOINING", tasks: { create: CHECKLISTS.JOINING.map((t, i) => ({ ...t, sort: i })) } } },
    },
  });
  return emp;
}

export async function updateEmployee(v: Viewer, id: number, input: EmployeeInput) {
  if (v.role !== "HR") throw new AppError("Only HR can edit employee details.", 403);
  const existing = await db.employee.findUnique({ where: { id } });
  if (!existing) throw new AppError("Employee not found.", 404);
  const { name, email, phone, preset, branch, ctc } = await validate(input, id);
  const status = input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  // Access is managed under Users & roles, not by designation.
  const accessRole = existing.accessRole;
  return db.employee.update({
    where: { id },
    data: {
      name,
      email,
      phone,
      gender: input.gender === "F" ? "F" : "M",
      designation: input.designation,
      department: preset.department,
      accessRole,
      plan: preset.plan,
      joinDate: parseDate(input.joinDate),
      monthlyCtc: Math.round(ctc),
      branchId: branch.id,
      managerId: existing.branchId === branch.id ? existing.managerId : accessRole === "MANAGER" ? null : await branchManagerId(branch.id, id),
      status,
    },
  });
}
