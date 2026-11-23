import { handle } from "@/lib/api";
import { markAssignment } from "@/services/training";
import { getViewer } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => markAssignment(await getViewer("training"), Number((await ctx.params).id), Boolean((await req.json()).done)));
}
