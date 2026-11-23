import { handle } from "@/lib/api";
import { createJob } from "@/services/recruitment";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => createJob(await getViewer("recruitment"), await req.json()));
}
