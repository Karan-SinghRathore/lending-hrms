import { handle } from "@/lib/api";
import { deleteRole, saveRole } from "@/services/users";
import { getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => saveRole(await getViewer("users"), oid((await ctx.params).id), await req.json()));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => deleteRole(await getViewer("users"), oid((await ctx.params).id)));
}
