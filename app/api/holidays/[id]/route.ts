import { handle } from "@/lib/api";
import { removeHoliday } from "@/services/holidays";
import { getViewer, oid } from "@/services/viewer";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => removeHoliday(await getViewer("leave"), oid((await ctx.params).id)));
}
