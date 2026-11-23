import { handle } from "@/lib/api";
import { setJobStatus } from "@/services/recruitment";
import { getViewer, oid } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => setJobStatus(await getViewer("recruitment"), oid((await ctx.params).id), String((await req.json()).status ?? "")));
}
