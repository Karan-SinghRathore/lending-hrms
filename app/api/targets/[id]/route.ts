import { handle } from "@/lib/api";
import { updateTarget } from "@/services/targets";
import { getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await req.json();
    return updateTarget(await getViewer("targets"), oid(id), {
      achieved: body.achieved === undefined ? undefined : Number(body.achieved),
      target: body.target === undefined ? undefined : Number(body.target),
    });
  });
}
