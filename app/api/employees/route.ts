import { handle } from "@/lib/api";
import { createEmployee } from "@/services/employees";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => createEmployee(await getViewer("employees"), await req.json()));
}
