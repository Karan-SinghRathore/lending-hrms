import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { deleteDocument, getDocumentFile, verifyDocument } from "@/services/documents";
import { AppError, getViewer, oid } from "@/services/viewer";

type Ctx = { params: Promise<{ id: string }> };

// Serves the file itself, to people allowed to see that employee.
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const doc = await getDocumentFile(await getViewer("documents"), oid((await ctx.params).id));
    return new NextResponse(Buffer.from(doc.data), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof AppError ? e.message : "Something went wrong." }, { status });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => verifyDocument(await getViewer("documents"), oid((await ctx.params).id), Boolean((await req.json()).verified)));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => deleteDocument(await getViewer("documents"), oid((await ctx.params).id)));
}
