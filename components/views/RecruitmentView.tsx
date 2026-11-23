"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Box, Button, Group, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { CANDIDATE_SOURCES, CANDIDATE_STAGES, DESIGNATIONS, STAGE_LABEL } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { longDate, todayStr } from "@/lib/dates";
import { rupees } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Empty, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";
import { EmployeeFormModal } from "./EmployeeFormModal";

export type CandidateRow = { id: number; name: string; phone: string; source: string; stage: string; expectedCtc: number | null; notes: string | null; employeeId: number | null; addedOn: string };
export type JobRow = { id: number; title: string; branchId: number; branch: string; openings: number; status: string; openedOn: string; candidates: CandidateRow[] };

const STAGE_COLOR: Record<string, string> = { APPLIED: "gray", SCREENING: "blue", INTERVIEW: "violet", OFFERED: "yellow", HIRED: "teal", REJECTED: "red" };
const active = (c: CandidateRow) => !["HIRED", "REJECTED"].includes(c.stage);

export function RecruitmentView({
  role,
  canAddEmployee,
  jobs,
  branches,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  canAddEmployee: boolean;
  jobs: JobRow[];
  branches: { id: number; name: string }[];
}) {
  const router = useRouter();
  const isHr = role === "HR";
  const [jobId, setJobId] = useState<number | null>(jobs.find((j) => j.status === "OPEN")?.id ?? jobs[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newJob, setNewJob] = useState(false);
  const [jobForm, setJobForm] = useState<{ title: string | null; branchId: string | null; openings: number | string }>({ title: null, branchId: null, openings: 1 });
  const [adding, setAdding] = useState(false);
  const [cand, setCand] = useState({ name: "", phone: "", source: CANDIDATE_SOURCES[0], expectedCtc: "" as number | string, notes: "" });
  const [converting, setConverting] = useState<CandidateRow | null>(null);

  const job = jobs.find((j) => j.id === jobId) ?? null;
  const allCandidates = jobs.flatMap((j) => j.candidates);

  async function run(key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(key);
    try {
      await fn();
      notifyOk(ok);
      after?.();
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  const jobColumns: Column<JobRow>[] = [
    { key: "title", header: "Position", value: (j) => j.title, render: (j) => <Text size="sm" fw={j.id === jobId ? 600 : 500}>{j.title}</Text> },
    { key: "branch", header: "Branch", value: (j) => j.branch },
    { key: "openings", header: "Openings", align: "right", value: (j) => j.openings },
    { key: "pipeline", header: "In pipeline", align: "right", value: (j) => j.candidates.filter(active).length },
    { key: "hired", header: "Hired", align: "right", value: (j) => j.candidates.filter((c) => c.stage === "HIRED").length, render: (j) => `${j.candidates.filter((c) => c.stage === "HIRED").length} of ${j.openings}` },
    { key: "opened", header: "Opened", value: (j) => j.openedOn, render: (j) => longDate(j.openedOn) },
    { key: "status", header: "Status", value: (j) => j.status, render: (j) => <StatusBadge status={j.status} /> },
    ...(isHr
      ? [
          {
            key: "act",
            header: "",
            noExport: true,
            align: "right" as const,
            render: (j: JobRow) => (
              <Button
                size="compact-xs"
                variant="default"
                loading={busy === `job-${j.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const status = j.status === "OPEN" ? "CLOSED" : "OPEN";
                  run(`job-${j.id}`, () => api(`/api/recruitment/jobs/${j.id}`, "PATCH", { status }), status === "CLOSED" ? "Position closed." : "Position reopened.");
                }}
              >
                {j.status === "OPEN" ? "Close" : "Reopen"}
              </Button>
            ),
          },
        ]
      : []),
  ];

  // Branch managers run screening and interviews; offers and hiring stay with HR.
  const stageOptions = (c: CandidateRow) =>
    CANDIDATE_STAGES.filter((s) => isHr || !["OFFERED", "HIRED"].includes(s) || s === c.stage).map((s) => ({ value: s, label: STAGE_LABEL[s] }));

  const candidateColumns: Column<CandidateRow>[] = [
    {
      key: "name",
      header: "Candidate",
      value: (c) => c.name,
      render: (c) => (
        <Box>
          <Text size="sm" fw={500}>
            {c.name}
          </Text>
          <Text size="xs" c="dimmed">
            +91 {c.phone}
          </Text>
        </Box>
      ),
    },
    { key: "source", header: "Source", value: (c) => c.source },
    { key: "ctc", header: "Expected CTC", align: "right", value: (c) => c.expectedCtc, render: (c) => (c.expectedCtc ? rupees(c.expectedCtc) : "—") },
    { key: "notes", header: "Notes", sortable: false, value: (c) => c.notes ?? "", render: (c) => <Text size="sm" c="dimmed">{c.notes ?? "—"}</Text> },
    { key: "added", header: "Added", value: (c) => c.addedOn, render: (c) => longDate(c.addedOn) },
    {
      key: "stage",
      header: "Stage",
      width: 160,
      value: (c) => STAGE_LABEL[c.stage],
      render: (c) =>
        c.employeeId || (!isHr && ["OFFERED", "HIRED"].includes(c.stage)) ? (
          <Badge color={STAGE_COLOR[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
        ) : (
          <Select
            size="xs"
            aria-label={`Stage for ${c.name}`}
            value={c.stage}
            disabled={busy === `c-${c.id}`}
            data={stageOptions(c)}
            onChange={(stage) => stage && stage !== c.stage && run(`c-${c.id}`, () => api(`/api/recruitment/candidates/${c.id}`, "PATCH", { stage }), `${c.name} moved to ${STAGE_LABEL[stage].toLowerCase()}.`)}
          />
        ),
    },
    {
      key: "act",
      header: "",
      noExport: true,
      align: "right",
      width: 150,
      render: (c) =>
        c.employeeId ? (
          <Button size="compact-xs" variant="subtle" onClick={() => router.push(`/employees/${c.employeeId}`)}>
            View employee
          </Button>
        ) : c.stage === "HIRED" && isHr && canAddEmployee ? (
          <Button size="compact-xs" onClick={() => setConverting(c)}>
            Add as employee
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Recruitment"
        subtitle={isHr ? "Open positions and candidates across branches" : "Open positions and candidates for your branch"}
        actions={
          isHr ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setNewJob(true)}>
              New position
            </Button>
          ) : null
        }
      />

      <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="md">
        <Stat label="Open positions" value={jobs.filter((j) => j.status === "OPEN").length} hint={`${jobs.filter((j) => j.status === "OPEN").reduce((s, j) => s + j.openings, 0)} seats to fill`} />
        <Stat label="In pipeline" value={allCandidates.filter(active).length} hint="Not yet hired or rejected" />
        <Stat label="Interviews" value={allCandidates.filter((c) => c.stage === "INTERVIEW").length} />
        <Stat label="Offers out" value={allCandidates.filter((c) => c.stage === "OFFERED").length} tone={allCandidates.some((c) => c.stage === "OFFERED") ? "warn" : "default"} />
        <Stat label="Hired" value={allCandidates.filter((c) => c.stage === "HIRED").length} tone="good" hint={`${allCandidates.filter((c) => c.stage === "HIRED" && !c.employeeId).length} yet to be added as employee`} />
      </SimpleGrid>

      <Box mb="md">
        <DataTable rows={jobs} columns={jobColumns} rowKey={(j) => j.id} onRowClick={(j) => setJobId(j.id)} maxHeight={280} empty={isHr ? "No positions yet. Use New position to open one." : "No positions open for your branch."} />
      </Box>

      {job ? (
        <>
          <Group justify="space-between" mb="xs">
            <Title order={2}>
              {job.title} · {job.branch}
            </Title>
            <Button variant="default" leftSection={<IconPlus size={16} />} disabled={job.status !== "OPEN"} onClick={() => setAdding(true)}>
              Add candidate
            </Button>
          </Group>
          <DataTable rows={job.candidates} columns={candidateColumns} rowKey={(c) => c.id} csvName={`candidates-${job.title}-${job.branch}`} empty="No candidates on this position yet." />
        </>
      ) : (
        <Paper withBorder>
          <Empty>Select a position to see its candidates.</Empty>
        </Paper>
      )}

      <Modal opened={newJob} onClose={() => setNewJob(false)} title={<Text fw={600}>New position</Text>} size="sm">
        <Stack gap="md">
          <Select label="Position" placeholder="Choose" data={Object.keys(DESIGNATIONS)} value={jobForm.title} onChange={(v) => setJobForm((f) => ({ ...f, title: v }))} />
          <Select label="Branch" placeholder="Choose" data={branches.map((b) => ({ value: String(b.id), label: b.name }))} value={jobForm.branchId} onChange={(v) => setJobForm((f) => ({ ...f, branchId: v }))} />
          <NumberInput label="Number of openings" min={1} max={50} value={jobForm.openings} onChange={(v) => setJobForm((f) => ({ ...f, openings: v }))} />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setNewJob(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "newjob"}
              disabled={!jobForm.title || !jobForm.branchId}
              onClick={() =>
                run(
                  "newjob",
                  async () => {
                    const res = await api<{ id: number }>("/api/recruitment/jobs", "POST", { title: jobForm.title, branchId: Number(jobForm.branchId), openings: Number(jobForm.openings) });
                    setJobId(res.id);
                  },
                  "Position opened.",
                  () => {
                    setNewJob(false);
                    setJobForm({ title: null, branchId: null, openings: 1 });
                  },
                )
              }
            >
              Open position
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={adding && !!job} onClose={() => setAdding(false)} title={<Text fw={600}>Add candidate · {job?.title}, {job?.branch}</Text>} size="md">
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="md">
            <TextInput label="Full name" value={cand.name} onChange={(e) => setCand((c) => ({ ...c, name: e.currentTarget.value }))} data-autofocus />
            <TextInput label="Mobile number" placeholder="10 digits" maxLength={10} value={cand.phone} onChange={(e) => setCand((c) => ({ ...c, phone: e.currentTarget.value.replace(/\D/g, "") }))} />
            <Select label="Source" data={CANDIDATE_SOURCES} value={cand.source} onChange={(v) => setCand((c) => ({ ...c, source: v ?? CANDIDATE_SOURCES[0] }))} />
            <NumberInput label="Expected monthly CTC" prefix="₹" thousandSeparator="," thousandsGroupStyle="lakh" hideControls min={0} value={cand.expectedCtc} onChange={(v) => setCand((c) => ({ ...c, expectedCtc: v }))} />
          </SimpleGrid>
          <Textarea label="Notes" placeholder="Experience, current employer, anything useful" autosize minRows={2} value={cand.notes} onChange={(e) => setCand((c) => ({ ...c, notes: e.currentTarget.value }))} />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "cand"}
              disabled={!cand.name.trim() || cand.phone.length !== 10}
              onClick={() =>
                run("cand", () => api("/api/recruitment/candidates", "POST", { jobId: job!.id, ...cand, expectedCtc: Number(cand.expectedCtc) || undefined }), `${cand.name} added.`, () => {
                  setAdding(false);
                  setCand({ name: "", phone: "", source: CANDIDATE_SOURCES[0], expectedCtc: "", notes: "" });
                })
              }
            >
              Add candidate
            </Button>
          </Group>
        </Stack>
      </Modal>

      {converting && job ? (
        <EmployeeFormModal
          branches={branches}
          initial={{
            name: converting.name,
            email: "",
            phone: converting.phone,
            gender: "M",
            designation: job.title,
            branchId: job.branchId,
            joinDate: todayStr(),
            monthlyCtc: converting.expectedCtc ?? "",
            status: "ACTIVE",
          }}
          onClose={async (saved, id) => {
            const c = converting;
            setConverting(null);
            if (saved && id) {
              // Link the candidate to the new employee record so they can't be added twice.
              await run(`c-${c.id}`, () => api(`/api/recruitment/candidates/${c.id}`, "PATCH", { employeeId: id }), `${c.name} is now an employee.`);
            }
          }}
        />
      ) : null}
    </>
  );
}
