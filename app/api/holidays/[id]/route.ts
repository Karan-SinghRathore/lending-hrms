import { handle } from "@/lib/api";
import { removeHoliday } from "@/services/holidays";
import { getViewer } from "@/services/viewer";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => removeHoliday(await getViewer("leave"), Number((await ctx.params).id)));
}
