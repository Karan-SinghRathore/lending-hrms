import { handle } from "@/lib/api";
import { markPaid, runPayroll } from "@/services/payroll";
import { AppError, getViewer } from "@/services/viewer";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const month = String(body.month ?? "");
    if (body.action === "RUN") return runPayroll(await getViewer("payroll"), month);
    if (body.action === "PAY") return markPaid(await getViewer("payroll"), month);
    throw new AppError("Unknown action.");
  });
}
