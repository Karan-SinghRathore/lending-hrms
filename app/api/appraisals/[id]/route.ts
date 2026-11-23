import { handle } from "@/lib/api";
import { submitStep } from "@/services/appraisals";
import { getViewer } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await req.json();
    return submitStep(await getViewer("appraisals"), Number((await ctx.params).id), {
      rating: body.rating,
      comment: body.comment,
      incrementPct: body.incrementPct,
    });
  });
}
