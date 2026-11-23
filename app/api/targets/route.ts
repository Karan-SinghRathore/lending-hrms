import { handle } from "@/lib/api";
import { deleteTargets, setTargets } from "@/services/targets";
import { getViewer, oid } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return setTargets(await getViewer("targets"), {
      employeeId: oid(body.employeeId),
      month: String(body.month ?? ""),
      values: body.values ?? {},
    });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const body = await req.json();
    return deleteTargets(await getViewer("targets"), oid(body.employeeId), String(body.month ?? ""));
  });
}
