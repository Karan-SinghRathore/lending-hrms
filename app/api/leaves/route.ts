import { handle } from "@/lib/api";
import { applyLeave } from "@/services/leaves";
import { getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return applyLeave(await getViewer("leave"), {
      type: String(body.type ?? ""),
      fromDate: String(body.fromDate ?? ""),
      toDate: String(body.toDate ?? ""),
      halfDay: Boolean(body.halfDay),
      reason: String(body.reason ?? ""),
    });
  });
}
