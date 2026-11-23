import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { MODULES, type ModuleKey } from "@/lib/config";
import { db } from "@/lib/db";

// Demo only: no login. The switcher in the top bar picks which person you are,
// and everything else follows from that person's role.
export const USER_COOKIE = "demo_user";

/** Data scope of a role: whole company, own branch, or own records. */
export type Role = "HR" | "MANAGER" | "EMPLOYEE";

export type Viewer = {
  role: Role;
  roleName: string;
  modules: ModuleKey[];
  id: string;
  name: string;
  code: string;
  designation: string;
  branchId: string;
  branchName: string;
  plan: string;
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function parseModules(json: string | null | undefined): ModuleKey[] {
  try {
    const list = JSON.parse(json ?? "[]") as string[];
    return list.filter((m): m is ModuleKey => m in MODULES);
  } catch {
    return [];
  }
}

/**
 * Who is using the app. Pass a module to refuse the request when the
 * person's role does not include it (used by every API route).
 */
export async function getViewer(module?: ModuleKey): Promise<Viewer> {
  const store = await cookies();
  const raw = store.get(USER_COOKIE)?.value ?? "";
  const id = OBJECT_ID.test(raw) ? raw : null;
  const include = { branch: true, role: true } as const;
  const emp =
    (id ? await db.employee.findFirst({ where: { id, status: "ACTIVE" }, include }) : null) ??
    (await db.employee.findFirst({ where: { role: { locked: true }, status: "ACTIVE" }, include, orderBy: { id: "asc" } }));
  if (!emp || !emp.role) throw new Error("Demo data missing. Run `npm run seed`.");

  const viewer: Viewer = {
    role: emp.role.base as Role,
    roleName: emp.role.name,
    modules: parseModules(emp.role.modules),
    id: emp.id,
    name: emp.name,
    code: emp.code,
    designation: emp.designation,
    branchId: emp.branchId,
    branchName: emp.branch.name,
    plan: emp.plan,
  };
  if (module && !viewer.modules.includes(module)) {
    throw new AppError(`Your role (${viewer.roleName}) does not have access to ${MODULES[module]}.`, 403);
  }
  return viewer;
}

export function can(v: Viewer, module: ModuleKey) {
  return v.modules.includes(module);
}

/** Which employees this viewer may see. */
export function employeeScope(v: Viewer): Prisma.EmployeeWhereInput {
  if (v.role === "HR") return { status: "ACTIVE" };
  if (v.role === "MANAGER") return { status: "ACTIVE", branchId: v.branchId };
  return { id: v.id };
}

export function canSee(v: Viewer, emp: { id: string; branchId: string }): boolean {
  if (v.role === "HR") return true;
  if (v.role === "MANAGER") return emp.branchId === v.branchId;
  return emp.id === v.id;
}

/** Checks that a value from the URL or request body is a database id; anything else is treated as "not found". */
export function oid(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  if (!OBJECT_ID.test(s)) throw new AppError("Record not found.", 404);
  return s;
}
