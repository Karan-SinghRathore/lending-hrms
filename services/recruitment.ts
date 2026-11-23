import { db } from "@/lib/db";
import { CANDIDATE_SOURCES, CANDIDATE_STAGES, DESIGNATIONS } from "@/lib/config";
import { AppError, type Viewer, oid } from "./viewer";

const jobScope = (v: Viewer) => (v.role === "HR" ? {} : { branchId: v.branchId });

export async function listJobs(v: Viewer) {
  if (v.role === "EMPLOYEE") return [];
  return db.jobOpening.findMany({
    where: jobScope(v),
    include: { branch: true, candidates: { orderBy: { updatedAt: "desc" } } },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
  });
}

export async function createJob(v: Viewer, input: { title: string; branchId: string; openings: number }) {
  if (v.role !== "HR") throw new AppError("Only HR can open a position.", 403);
  if (!DESIGNATIONS[input.title]) throw new AppError("Choose the position.");
  const branch = await db.branch.findUnique({ where: { id: oid(input.branchId) } });
  if (!branch) throw new AppError("Choose a branch.");
  const openings = Number(input.openings);
  if (!Number.isInteger(openings) || openings < 1 || openings > 50) throw new AppError("Openings must be between 1 and 50.");
  return db.jobOpening.create({ data: { title: input.title, branchId: branch.id, openings } });
}

export async function setJobStatus(v: Viewer, id: string, status: string) {
  if (v.role !== "HR") throw new AppError("Only HR can close or reopen a position.", 403);
  if (status !== "OPEN" && status !== "CLOSED") throw new AppError("Unknown status.");
  return db.jobOpening.update({ where: { id }, data: { status } });
}

async function jobFor(v: Viewer, jobId: string) {
  const job = await db.jobOpening.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("Position not found.", 404);
  if (v.role === "EMPLOYEE" || (v.role === "MANAGER" && job.branchId !== v.branchId)) throw new AppError("This position is not in your branch.", 403);
  return job;
}

export async function addCandidate(
  v: Viewer,
  input: { jobId: string; name: string; phone: string; source: string; expectedCtc?: number; notes?: string },
) {
  const job = await jobFor(v, oid(input.jobId));
  if (job.status !== "OPEN") throw new AppError("This position is closed.");
  const name = input.name?.trim();
  const phone = String(input.phone ?? "").replace(/\D/g, "");
  if (!name || name.length < 3) throw new AppError("Enter the candidate's full name.");
  if (phone.length !== 10) throw new AppError("Phone number must be 10 digits.");
  if (!CANDIDATE_SOURCES.includes(input.source)) throw new AppError("Choose where the candidate came from.");
  if (await db.candidate.findFirst({ where: { jobId: job.id, phone } })) throw new AppError("A candidate with this phone number is already on this position.");
  const ctc = Number(input.expectedCtc);
  return db.candidate.create({
    data: { jobId: job.id, name, phone, source: input.source, expectedCtc: Number.isFinite(ctc) && ctc > 0 ? Math.round(ctc) : null, notes: input.notes?.trim() || null },
  });
}

export async function updateCandidate(v: Viewer, id: string, input: { stage?: string; employeeId?: string }) {
  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) throw new AppError("Candidate not found.", 404);
  await jobFor(v, c.jobId);

  if (input.employeeId !== undefined) {
    if (v.role !== "HR") throw new AppError("Only HR can add a hired candidate as an employee.", 403);
    if (c.stage !== "HIRED") throw new AppError("Mark the candidate as hired first.");
    return db.candidate.update({ where: { id }, data: { employeeId: oid(input.employeeId) } });
  }

  const stage = input.stage as (typeof CANDIDATE_STAGES)[number];
  if (!CANDIDATE_STAGES.includes(stage)) throw new AppError("Unknown stage.");
  if (c.employeeId) throw new AppError("This candidate has already joined as an employee.");
  // Offers and hiring decisions stay with HR; the branch runs screening and interviews.
  if (v.role !== "HR" && (stage === "OFFERED" || stage === "HIRED" || c.stage === "OFFERED" || c.stage === "HIRED")) {
    throw new AppError("Only HR can make an offer or mark a candidate as hired.", 403);
  }
  return db.candidate.update({ where: { id }, data: { stage } });
}
