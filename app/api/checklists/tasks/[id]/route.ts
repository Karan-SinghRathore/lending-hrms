import { handle } from "@/lib/api";
import { toggleTask } from "@/services/checklists";
import { getViewer } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await req.json();
    return toggleTask(await getViewer("onboarding"), Number((await ctx.params).id), Boolean(body.done));
  });
}
