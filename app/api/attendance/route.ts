import { handle } from "@/lib/api";
import { checkInOut } from "@/services/attendance";
import { AppError, getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    if (body.kind !== "in" && body.kind !== "out") throw new AppError("Unknown action.");
    const lat = typeof body.lat === "number" ? body.lat : undefined;
    const lng = typeof body.lng === "number" ? body.lng : undefined;
    return checkInOut(await getViewer("attendance"), body.kind, lat, lng);
  });
}
