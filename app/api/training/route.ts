import { handle } from "@/lib/api";
import { createProgram } from "@/services/training";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => createProgram(await getViewer("training"), await req.json()));
}
