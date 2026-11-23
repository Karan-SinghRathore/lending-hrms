import { handle } from "@/lib/api";
import { addHoliday } from "@/services/holidays";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return addHoliday(await getViewer("leave"), { date: String(body.date ?? ""), name: String(body.name ?? "") });
  });
}
