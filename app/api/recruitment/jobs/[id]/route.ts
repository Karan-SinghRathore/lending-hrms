import { handle } from "@/lib/api";
import { setJobStatus } from "@/services/recruitment";
import { getViewer } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => setJobStatus(await getViewer("recruitment"), Number((await ctx.params).id), String((await req.json()).status ?? "")));
}
