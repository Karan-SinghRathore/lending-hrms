import { db } from "@/lib/db";
import { DOCUMENT_KINDS, MAX_UPLOAD_BYTES } from "@/lib/config";
import { longDate, toDateStr, todayStr } from "@/lib/dates";
import { LETTERS } from "@/lib/letters";
import { AppError, canSee, employeeScope, type Viewer } from "./viewer";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
// Scope by branch / self without the "active" filter so letters for people who have left stay visible.
const scope = (v: Viewer) => (v.role === "HR" ? {} : v.role === "MANAGER" ? { branchId: v.branchId } : { id: v.id });

export async function listDocuments(v: Viewer) {
  return db.employeeDocument.findMany({
    where: { employee: scope(v) },
    // Never load file bytes for a list.
    select: {
      id: true, employeeId: true, kind: true, fileName: true, mime: true, size: true, uploadedBy: true, uploadedAt: true, verified: true, verifiedBy: true,
      employee: { select: { name: true, code: true, branch: { select: { name: true } } } },
    },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploadDocument(v: Viewer, employeeId: string, kind: string, file: File | null) {
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("Choose an employee.");
  if (!canSee(v, emp)) throw new AppError("You can upload documents only for people you manage.", 403);
  if (!DOCUMENT_KINDS.includes(kind)) throw new AppError("Choose the document type.");
  if (!file || !file.size) throw new AppError("Choose a file to upload.");
  if (!ALLOWED.includes(file.type)) throw new AppError("Upload a PDF, JPG or PNG file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("File is larger than 2 MB.");
  const doc = await db.employeeDocument.create({
    data: { employeeId, kind, fileName: file.name.slice(0, 120), mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy: v.name },
    select: { id: true },
  });
  return doc;
}

export async function getDocumentFile(v: Viewer, id: string) {
  const doc = await db.employeeDocument.findUnique({ where: { id }, include: { employee: true } });
  if (!doc || !canSee(v, doc.employee)) throw new AppError("Document not found.", 404);
  return doc;
}

export async function verifyDocument(v: Viewer, id: string, verified: boolean) {
  if (v.role !== "HR") throw new AppError("Only HR can verify documents.", 403);
  return db.employeeDocument.update({ where: { id }, data: { verified, verifiedBy: verified ? v.name : null }, select: { id: true } });
}

export async function deleteDocument(v: Viewer, id: string) {
  const doc = await db.employeeDocument.findUnique({ where: { id }, select: { id: true, verified: true, employee: true } });
  if (!doc || !canSee(v, doc.employee)) throw new AppError("Document not found.", 404);
  if (v.role !== "HR" && doc.verified) throw new AppError("A verified document can be removed only by HR.", 403);
  if (v.role === "MANAGER") throw new AppError("Only HR or the employee can remove a document.", 403);
  return db.employeeDocument.delete({ where: { id }, select: { id: true } });
}

export async function listLetters(v: Viewer) {
  return db.letter.findMany({
    where: { employee: scope(v) },
    include: { employee: { select: { name: true, code: true, branch: { select: { name: true } } } } },
    orderBy: { issuedAt: "desc" },
  });
}

export async function issueLetter(v: Viewer, employeeId: string, type: string) {
  if (v.role !== "HR") throw new AppError("Only HR can issue letters.", 403);
  const template = LETTERS[type];
  if (!template) throw new AppError("Choose a letter type.");
  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { branch: true } });
  if (!emp) throw new AppError("Choose an employee.");
  const body = template.body({
    name: emp.name,
    code: emp.code,
    designation: emp.designation,
    department: emp.department,
    branch: emp.branch.name,
    joinDate: longDate(toDateStr(emp.joinDate)),
    monthlyCtc: emp.monthlyCtc,
    today: longDate(todayStr()),
    signedBy: v.name,
  });
  return db.letter.create({ data: { employeeId, type, body, issuedBy: v.name } });
}

export async function deleteLetter(v: Viewer, id: string) {
  if (v.role !== "HR") throw new AppError("Only HR can withdraw a letter.", 403);
  return db.letter.delete({ where: { id } });
}

export async function documentPeople(v: Viewer) {
  const rows = await db.employee.findMany({ where: employeeScope(v), include: { branch: true }, orderBy: { name: "asc" } });
  return rows.map((e) => ({ id: e.id, name: e.name, branch: e.branch.name }));
}
