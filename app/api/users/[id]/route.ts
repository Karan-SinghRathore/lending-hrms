import { handle } from "@/lib/api";
import { setUserRole } from "@/services/users";
import { getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await req.json();
    return setUserRole(await getViewer("users"), oid((await ctx.params).id), oid(body.roleId));
  });
}
