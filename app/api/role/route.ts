import { cookies } from "next/headers";
import { handle } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, USER_COOKIE, oid } from "@/services/viewer";

// Demo "view as" switcher. Stands in for login.
export async function POST(req: Request) {
  return handle(async () => {
    const { userId } = (await req.json()) as { userId: string };
    const emp = await db.employee.findFirst({ where: { id: oid(userId), status: "ACTIVE" } });
    if (!emp) throw new AppError("User not found.");
    (await cookies()).set(USER_COOKIE, String(emp.id), { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return { userId: emp.id };
  });
}
