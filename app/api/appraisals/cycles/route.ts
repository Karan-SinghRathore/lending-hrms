import { handle } from "@/lib/api";
import { closeCycle, startCycle } from "@/services/appraisals";
import { getViewer, oid } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    if (body.action === "CLOSE") return closeCycle(await getViewer("appraisals"), oid(body.id));
    return startCycle(await getViewer("appraisals"), {
      name: String(body.name ?? ""),
      fromMonth: String(body.fromMonth ?? ""),
      toMonth: String(body.toMonth ?? ""),
    });
  });
}
