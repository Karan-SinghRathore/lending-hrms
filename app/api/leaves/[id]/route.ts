import { handle } from "@/lib/api";
import { decideLeave } from "@/services/leaves";
import { AppError, getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await req.json();
    if (!["APPROVE", "REJECT", "CANCEL"].includes(body.action)) throw new AppError("Unknown action.");
    return decideLeave(await getViewer("leave"), oid(id), body.action, body.remark);
  });
}
