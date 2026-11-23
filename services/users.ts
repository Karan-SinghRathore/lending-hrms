import { db } from "@/lib/db";
import { MODULES, type ModuleKey } from "@/lib/config";
import { AppError, parseModules, type Viewer } from "./viewer";

export async function listRoles() {
  const roles = await db.role.findMany({ include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } }, orderBy: { id: "asc" } });
  return roles.map((r) => ({ id: r.id, name: r.name, base: r.base, locked: r.locked, modules: parseModules(r.modules), users: r._count.employees }));
}

export async function listUsers() {
  const rows = await db.employee.findMany({ where: { status: "ACTIVE" }, include: { branch: true, role: true }, orderBy: { name: "asc" } });
  return rows.map((e) => ({ id: e.id, name: e.name, code: e.code, designation: e.designation, branch: e.branch.name, roleId: e.roleId, roleName: e.role?.name ?? "—" }));
}

/** One person per role for the "view as" switcher, plus whoever is active now. */
export async function switcherPeople(currentId: number) {
  const roles = await db.role.findMany({
    include: { employees: { where: { status: "ACTIVE" }, include: { branch: true }, orderBy: { id: "asc" } } },
    orderBy: { id: "asc" },
  });
  // Prefer the people the demo data is built around.
  const preferred = ["Neha Agarwal", "Rohit Verma", "Ankit Jain"];
  return roles
    .filter((r) => r.employees.length)
    .map((r) => {
      const p = r.employees.find((e) => e.id === currentId) ?? r.employees.find((e) => preferred.includes(e.name)) ?? r.employees[0];
      return { id: p.id, name: p.name, designation: p.designation, branch: p.branch.name, roleName: r.name };
    });
}

function cleanModules(input: unknown): ModuleKey[] {
  const list = Array.isArray(input) ? input : [];
  const keys = (Object.keys(MODULES) as ModuleKey[]).filter((k) => list.includes(k));
  // Everyone lands on the dashboard, so it is always included.
  return keys.includes("dashboard") ? keys : ["dashboard", ...keys];
}

export async function saveRole(v: Viewer, id: number | null, input: { name?: string; base?: string; modules?: unknown }) {
  const modules = cleanModules(input.modules);
  if (id) {
    const role = await db.role.findUnique({ where: { id } });
    if (!role) throw new AppError("Role not found.", 404);
    if (role.locked) throw new AppError(`${role.name} always has full access and can't be changed.`);
    return db.role.update({ where: { id }, data: { modules: JSON.stringify(modules) } });
  }
  const name = input.name?.trim();
  if (!name) throw new AppError("Give the role a name.");
  if (!["HR", "MANAGER", "EMPLOYEE"].includes(input.base ?? "")) throw new AppError("Choose what data the role can see.");
  if (await db.role.findUnique({ where: { name } })) throw new AppError(`A role called ${name} already exists.`);
  return db.role.create({ data: { name, base: input.base!, modules: JSON.stringify(modules) } });
}

export async function deleteRole(v: Viewer, id: number) {
  const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!role) throw new AppError("Role not found.", 404);
  if (role.locked) throw new AppError(`${role.name} can't be deleted.`);
  if (role._count.employees) throw new AppError(`${role._count.employees} people still have this role. Move them to another role first.`);
  return db.role.delete({ where: { id } });
}

export async function setUserRole(v: Viewer, employeeId: number, roleId: number) {
  if (employeeId === v.id) throw new AppError("You can't change your own role.");
  const [emp, role] = await Promise.all([db.employee.findUnique({ where: { id: employeeId } }), db.role.findUnique({ where: { id: roleId } })]);
  if (!emp || !role) throw new AppError("Choose a user and a role.");
  return db.employee.update({ where: { id: employeeId }, data: { roleId: role.id, accessRole: role.base } });
}
