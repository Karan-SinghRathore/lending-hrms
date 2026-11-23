import { handle } from "@/lib/api";
import { uploadDocument } from "@/services/documents";
import { getViewer } from "@/services/viewer";

// Multipart upload: employeeId, kind, file.
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData();
    const file = form.get("file");
    return uploadDocument(await getViewer("documents"), Number(form.get("employeeId")), String(form.get("kind") ?? ""), file instanceof File ? file : null);
  });
}
