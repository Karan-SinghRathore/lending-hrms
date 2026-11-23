import { handle } from "@/lib/api";
import { startCase } from "@/services/checklists";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return startCase(await getViewer("onboarding"), Number(body.employeeId), String(body.kind ?? ""));
  });
}
