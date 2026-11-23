import { handle } from "@/lib/api";
import { deleteProgram } from "@/services/training";
import { getViewer } from "@/services/viewer";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => deleteProgram(await getViewer("training"), Number((await ctx.params).id)));
}
