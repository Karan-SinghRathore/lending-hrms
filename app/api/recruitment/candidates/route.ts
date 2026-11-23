import { handle } from "@/lib/api";
import { addCandidate } from "@/services/recruitment";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => addCandidate(await getViewer("recruitment"), await req.json()));
}
