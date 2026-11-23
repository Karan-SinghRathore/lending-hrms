import { handle } from "@/lib/api";
import { updateCandidate } from "@/services/recruitment";
import { getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await req.json();
    return updateCandidate(await getViewer("recruitment"), oid((await ctx.params).id), {
      stage: body.stage,
      employeeId: body.employeeId === undefined ? undefined : oid(body.employeeId),
    });
  });
}
