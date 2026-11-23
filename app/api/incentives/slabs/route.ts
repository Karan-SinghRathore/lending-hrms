import { handle } from "@/lib/api";
import { saveSlabs } from "@/services/incentives";
import { getViewer } from "@/services/viewer";

export async function PUT(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const slabs = (Array.isArray(body.slabs) ? body.slabs : []).map(
      (s: { minPct: unknown; maxPct: unknown; amount: unknown }) => ({
        minPct: Number(s.minPct),
        maxPct: s.maxPct === null || s.maxPct === "" || s.maxPct === undefined ? null : Number(s.maxPct),
        amount: Number(s.amount),
      }),
    );
    await saveSlabs(await getViewer("incentives"), String(body.plan ?? ""), slabs);
    return { saved: true };
  });
}
