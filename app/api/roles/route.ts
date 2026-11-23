import { handle } from "@/lib/api";
import { saveRole } from "@/services/users";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => saveRole(await getViewer("users"), null, await req.json()));
}
