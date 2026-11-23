import { handle } from "@/lib/api";
import { issueLetter } from "@/services/documents";
import { getViewer, oid } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return issueLetter(await getViewer("documents"), oid(body.employeeId), String(body.type ?? ""));
  });
}
