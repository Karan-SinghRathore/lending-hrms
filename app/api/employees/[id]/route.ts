import { handle } from "@/lib/api";
import { updateEmployee } from "@/services/employees";
import { getViewer } from "@/services/viewer";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => updateEmployee(await getViewer("employees"), Number((await ctx.params).id), await req.json()));
}
