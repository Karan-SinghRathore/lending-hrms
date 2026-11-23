import { handle } from "@/lib/api";
import { deleteLetter } from "@/services/documents";
import { getViewer } from "@/services/viewer";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => deleteLetter(await getViewer("documents"), Number((await ctx.params).id)));
}
