"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Box, Button, Group, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { RATINGS } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { monthLabel } from "@/lib/dates";
import { pct } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Empty, PageHeader, Stat } from "@/components/ui/primitives";

export type Cycle = { id: string; name: string; fromMonth: string; toMonth: string; status: string };
export type ReviewRow = {
  id: string;
  employeeId: string;
  name: string;
  code: string;
  designation: string;
  branch: string;
  manager: string | null;
  managerId: string | null;
  targetScore: number | null;
  selfRating: number | null;
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
  finalRating: number | null;
  incrementPct: number | null;
  hrComment: string | null;
  status: string;
};

const STEP: Record<string, { label: string; color: string }> = {
  SELF: { label: "Self review pending", color: "yellow" },
  MANAGER: { label: "With manager", color: "blue" },
  HR: { label: "With HR", color: "violet" },
  DONE: { label: "Finalised", color: "teal" },
};

const ratingOptions = Object.entries(RATINGS).map(([value, label]) => ({ value, label }));

function ReviewModal({ row, action, onClose }: { row: ReviewRow; action: "SELF" | "MANAGER" | "HR" | null; onClose: (saved: boolean) => void }) {
  const [rating, setRating] = useState<string | null>(action === "HR" && row.managerRating ? String(row.managerRating) : null);
  const [comment, setComment] = useState("");
  const [increment, setIncrement] = useState<number | string>("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api(`/api/appraisals/${row.id}`, "PATCH", { rating: Number(rating), comment, incrementPct: increment === "" ? 0 : Number(increment) });
      notifyOk(action === "SELF" ? "Self review submitted to your manager." : action === "MANAGER" ? `Review for ${row.name} sent to HR.` : `Review for ${row.name} finalised.`);
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const past = (title: string, r: number | null, c: string | null) =>
    r ? (
      <Paper withBorder p="sm" radius="sm">
        <Group justify="space-between" mb={4}>
          <Text size="xs" fw={600} c="gray.7">
            {title}
          </Text>
          <Badge color="gray">{RATINGS[r]}</Badge>
        </Group>
        <Text size="sm">{c || "No comments."}</Text>
      </Paper>
    ) : null;

  return (
    <Modal opened onClose={() => onClose(false)} size="lg" title={<Text fw={600}>{action === "SELF" ? "My self review" : `Review · ${row.name}`}</Text>}>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {row.designation} · {row.branch} · {row.code}
          </Text>
          <Text size="sm">
            Target score in period: <b>{row.targetScore != null ? pct(row.targetScore, 1) : "Not on a target plan"}</b>
          </Text>
        </Group>
        {past("Self review", row.selfRating, row.selfComment)}
        {past(`Manager review${row.manager ? ` · ${row.manager}` : ""}`, row.managerRating, row.managerComment)}
        {row.status === "DONE" ? (
          <Paper withBorder p="sm" radius="sm" bg="gray.0">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={600} c="gray.7">
                Final outcome
              </Text>
              <Group gap={6}>
                <Badge color="teal">{RATINGS[row.finalRating ?? 3]}</Badge>
                <Badge color="brand">Increment {row.incrementPct ?? 0}%</Badge>
              </Group>
            </Group>
            <Text size="sm">{row.hrComment || "No comments."}</Text>
          </Paper>
        ) : null}

        {action ? (
          <>
            <SimpleGrid cols={action === "HR" ? 2 : 1} spacing="md">
              <Select label={action === "SELF" ? "How do you rate your half-year?" : action === "MANAGER" ? "Your rating" : "Final rating"} placeholder="Choose" value={rating} onChange={setRating} data={ratingOptions} />
              {action === "HR" ? <NumberInput label="Increment" placeholder="0" suffix="%" min={0} max={50} value={increment} onChange={setIncrement} hideControls /> : null}
            </SimpleGrid>
            <Textarea
              label={action === "SELF" ? "What went well, what didn't, what you need" : action === "MANAGER" ? "Comments for the employee" : "HR note (optional)"}
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              autosize
              minRows={3}
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={() => onClose(false)}>
                Cancel
              </Button>
              <Button onClick={submit} loading={saving} disabled={!rating || (action !== "HR" && !comment.trim())}>
                {action === "SELF" ? "Submit to manager" : action === "MANAGER" ? "Send to HR" : "Finalise"}
              </Button>
            </Group>
          </>
        ) : (
          <Text size="xs" c="dimmed">
            {row.status === "DONE" ? "This review is finalised." : `Current step: ${STEP[row.status].label.toLowerCase()}.`}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

export function AppraisalsView({
  role,
  viewerId,
  cycles,
  cycle,
  rows,
  monthOptions,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  viewerId: string;
  cycles: Cycle[];
  cycle: Cycle | null;
  rows: ReviewRow[];
  monthOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<ReviewRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState<string | null>(monthOptions[monthOptions.length - 1] ?? null);
  const [to, setTo] = useState<string | null>(monthOptions[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("ALL");

  /** What this viewer can do on a row right now, if anything. */
  function actionFor(r: ReviewRow): "SELF" | "MANAGER" | "HR" | null {
    if (!cycle || cycle.status !== "OPEN") return null;
    if (r.status === "SELF" && r.employeeId === viewerId) return "SELF";
    if (r.status === "MANAGER" && r.managerId === viewerId) return "MANAGER";
    if (r.status === "HR" && role === "HR" && r.employeeId !== viewerId) return "HR";
    return null;
  }
  const ACTION_LABEL = { SELF: "Write self review", MANAGER: "Review", HR: "Finalise" };

  async function cycleAction(body: object, ok: string) {
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/appraisals/cycles", "POST", body);
      notifyOk(ok);
      setStarting(false);
      router.push(`${pathname}?cycle=${res.id}`);
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const mine = rows.filter((r) => actionFor(r)).length;
  const visible = rows.filter((r) => step === "ALL" || (step === "MINE" ? actionFor(r) : r.status === step));

  const columns: Column<ReviewRow>[] = [
    {
      key: "name",
      header: "Employee",
      value: (r) => r.name,
      render: (r) => (
        <Box>
          <Text size="sm" fw={500}>
            {r.name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.designation} · {r.branch}
          </Text>
        </Box>
      ),
    },
    { key: "manager", header: "Manager", value: (r) => r.manager ?? "—" },
    { key: "score", header: "Target score", align: "right", value: (r) => r.targetScore, render: (r) => (r.targetScore != null ? pct(r.targetScore, 1) : "—") },
    { key: "self", header: "Self", align: "center", value: (r) => r.selfRating, render: (r) => r.selfRating ?? "—" },
    { key: "mgr", header: "Manager", align: "center", value: (r) => r.managerRating, render: (r) => r.managerRating ?? "—" },
    { key: "final", header: "Final", align: "center", value: (r) => r.finalRating, render: (r) => (r.finalRating ? <b>{r.finalRating}</b> : "—") },
    { key: "inc", header: "Increment", align: "right", value: (r) => r.incrementPct, render: (r) => (r.incrementPct != null ? `${r.incrementPct}%` : "—") },
    { key: "status", header: "Step", value: (r) => STEP[r.status].label, render: (r) => <Badge color={STEP[r.status].color}>{STEP[r.status].label}</Badge> },
    {
      key: "action",
      header: "",
      noExport: true,
      align: "right",
      width: 150,
      render: (r) => {
        const a = actionFor(r);
        return (
          <Button size="compact-xs" variant={a ? "filled" : "default"} onClick={() => setOpen(r)}>
            {a ? ACTION_LABEL[a] : "View"}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Appraisals"
        subtitle={cycle ? `${cycle.name} · ${monthLabel(cycle.fromMonth)} to ${monthLabel(cycle.toMonth)} · ${cycle.status === "OPEN" ? "open" : "closed"}` : "No appraisal cycle yet"}
        actions={
          <>
            {cycles.length > 1 ? (
              <Select
                w={230}
                aria-label="Cycle"
                value={cycle ? String(cycle.id) : null}
                onChange={(v) => v && router.push(`${pathname}?cycle=${v}`)}
                data={cycles.map((c) => ({ value: String(c.id), label: `${c.name}${c.status === "CLOSED" ? " (closed)" : ""}` }))}
              />
            ) : null}
            {role === "HR" && cycle?.status === "OPEN" ? (
              <Button variant="default" loading={busy} onClick={() => cycleAction({ action: "CLOSE", id: cycle.id }, "Cycle closed.")}>
                Close cycle
              </Button>
            ) : null}
            {role === "HR" && !cycles.some((c) => c.status === "OPEN") ? (
              <Button leftSection={<IconPlus size={16} />} onClick={() => setStarting(true)}>
                Start cycle
              </Button>
            ) : null}
          </>
        }
      />

      {cycle ? (
        <>
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="md">
            <Stat label="Waiting on you" value={mine} tone={mine ? "warn" : "default"} hint={mine ? "Use the buttons in the table" : "Nothing pending"} />
            <Stat label="Self review pending" value={count("SELF")} />
            <Stat label="With manager" value={count("MANAGER")} />
            <Stat label="With HR" value={count("HR")} />
            <Stat label="Finalised" value={`${count("DONE")} of ${rows.length}`} tone="good" />
          </SimpleGrid>
          <DataTable
            rows={visible}
            columns={columns}
            rowKey={(r) => r.id}
            searchPlaceholder={role === "EMPLOYEE" ? undefined : "Search employee"}
            csvName={role === "EMPLOYEE" ? undefined : `appraisals-${cycle.name}`}
            maxHeight={600}
            filters={
              role === "EMPLOYEE" ? undefined : (
                <Select
                  w={200}
                  aria-label="Step"
                  value={step}
                  onChange={(v) => setStep(v ?? "ALL")}
                  data={[
                    { value: "ALL", label: "All steps" },
                    { value: "MINE", label: "Waiting on me" },
                    { value: "SELF", label: "Self review pending" },
                    { value: "MANAGER", label: "With manager" },
                    { value: "HR", label: "With HR" },
                    { value: "DONE", label: "Finalised" },
                  ]}
                />
              )
            }
          />
        </>
      ) : (
        <Paper withBorder>
          <Empty>{role === "HR" ? "Start a cycle to open self reviews for every employee." : "HR has not started an appraisal cycle yet."}</Empty>
        </Paper>
      )}

      {open ? (
        <ReviewModal
          row={open}
          action={actionFor(open)}
          onClose={(saved) => {
            setOpen(null);
            if (saved) router.refresh();
          }}
        />
      ) : null}

      <Modal opened={starting} onClose={() => setStarting(false)} title={<Text fw={600}>Start appraisal cycle</Text>} size="md">
        <Stack gap="md">
          <TextInput label="Cycle name" placeholder="e.g. Half-yearly review, Oct–Mar" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
          <SimpleGrid cols={2} spacing="md">
            <Select label="Period from" value={from} onChange={setFrom} data={monthOptions.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <Select label="Period to" value={to} onChange={setTo} data={monthOptions.map((m) => ({ value: m, label: monthLabel(m) }))} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Every active employee gets a review. Their average target score for the period is filled in automatically. Steps: self review, manager review, HR finalises rating and increment.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setStarting(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!name.trim() || !from || !to} onClick={() => cycleAction({ name, fromMonth: from, toMonth: to }, "Cycle started. Self reviews are open.")}>
              Start cycle
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
