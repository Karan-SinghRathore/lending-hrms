"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Box, Button, Group, Modal, Progress, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconPlus } from "@tabler/icons-react";
import { TRAINING_CATEGORIES } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { longDate, todayStr } from "@/lib/dates";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader, Stat } from "@/components/ui/primitives";

export type Assignee = { id: number; employeeId: number; name: string; designation: string; branch: string; status: string; completedOn: string | null; markedBy: string | null };
export type ProgramRow = { id: number; title: string; category: string; mandatory: boolean; dueDate: string | null; description: string | null; assignees: Assignee[] };

const done = (p: ProgramRow) => p.assignees.filter((a) => a.status === "COMPLETED").length;
const overdue = (p: ProgramRow) => !!p.dueDate && p.dueDate < todayStr() && done(p) < p.assignees.length;

export function TrainingView({
  role,
  viewerId,
  programs,
  audiences,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  viewerId: number;
  programs: ProgramRow[];
  audiences: Record<string, string>;
}) {
  const router = useRouter();
  const isHr = role === "HR";
  const self = role === "EMPLOYEE";
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", category: TRAINING_CATEGORIES[2], mandatory: true, dueDate: null as string | null, description: "", audience: "ALL" });

  const open = programs.find((p) => p.id === openId) ?? null;
  const allAssignments = programs.flatMap((p) => p.assignees);
  const mine = (p: ProgramRow) => p.assignees.find((a) => a.employeeId === viewerId);

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
  const mark = (a: Assignee, value: boolean, title: string) =>
    run(`a-${a.id}`, () => api(`/api/training/assignments/${a.id}`, "PATCH", { done: value }), value ? `${title} marked complete.` : "Reopened.");

  const columns: Column<ProgramRow>[] = [
    {
      key: "title",
      header: "Training",
      value: (p) => p.title,
      render: (p) => (
        <Box>
          <Group gap={6}>
            <Text size="sm" fw={500}>
              {p.title}
            </Text>
            {p.mandatory ? <Badge color="red">Mandatory</Badge> : null}
          </Group>
          {p.description ? (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {p.description}
            </Text>
          ) : null}
        </Box>
      ),
    },
    { key: "category", header: "Category", value: (p) => p.category },
    {
      key: "due",
      header: "Due",
      value: (p) => p.dueDate ?? "",
      render: (p) => (p.dueDate ? <Text size="sm" c={overdue(p) ? "red.8" : undefined}>{longDate(p.dueDate)}{overdue(p) ? " · overdue" : ""}</Text> : "—"),
    },
    ...(self
      ? [
          {
            key: "mine",
            header: "My status",
            value: (p: ProgramRow) => mine(p)?.status ?? "",
            render: (p: ProgramRow) => {
              const a = mine(p);
              if (!a) return "—";
              return a.status === "COMPLETED" ? (
                <Badge color="teal">Completed · {a.completedOn ? longDate(a.completedOn) : ""}</Badge>
              ) : (
                <Button size="compact-xs" loading={busy === `a-${a.id}`} onClick={() => mark(a, true, p.title)}>
                  Mark as completed
                </Button>
              );
            },
          },
        ]
      : [
          {
            key: "progress",
            header: "Completion",
            width: 230,
            value: (p: ProgramRow) => (p.assignees.length ? done(p) / p.assignees.length : 0),
            render: (p: ProgramRow) => (
              <Group gap="xs" wrap="nowrap">
                <Progress value={p.assignees.length ? (done(p) / p.assignees.length) * 100 : 0} size={6} radius="xs" color={done(p) === p.assignees.length ? "teal" : "brand"} style={{ flex: 1 }} />
                <Text size="xs" c="dimmed" className="num" w={48} ta="right">
                  {done(p)}/{p.assignees.length}
                </Text>
              </Group>
            ),
          },
          {
            key: "open",
            header: "",
            noExport: true,
            align: "right" as const,
            render: (p: ProgramRow) => (
              <Button size="compact-xs" variant="default" onClick={() => setOpenId(p.id)}>
                Attendees
              </Button>
            ),
          },
        ]),
  ];

  return (
    <>
      <PageHeader
        title={self ? "My training" : "Training"}
        subtitle={self ? "Trainings assigned to you" : isHr ? "Assign trainings and track who has completed them" : "Training completion for your branch"}
        actions={
          isHr ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
              New training
            </Button>
          ) : null
        }
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
        <Stat label="Trainings" value={programs.length} hint={`${programs.filter((p) => p.mandatory).length} mandatory`} />
        <Stat label="Completed" value={`${allAssignments.filter((a) => a.status === "COMPLETED").length} of ${allAssignments.length}`} tone="good" hint={self ? "Assigned to you" : "Assignments"} />
        <Stat label="Pending" value={allAssignments.filter((a) => a.status !== "COMPLETED").length} tone={allAssignments.some((a) => a.status !== "COMPLETED") ? "warn" : "default"} />
        <Stat label="Overdue trainings" value={programs.filter(overdue).length} tone={programs.some(overdue) ? "bad" : "default"} hint="Past due date, not everyone done" />
      </SimpleGrid>

      <DataTable rows={programs} columns={columns} rowKey={(p) => p.id} searchPlaceholder={self ? undefined : "Search training"} csvName={self ? undefined : "trainings"} empty={isHr ? "No trainings yet. Use New training." : "No trainings assigned."} />

      {open ? (
        <Modal opened onClose={() => setOpenId(null)} size="lg" title={<Text fw={600}>{open.title}</Text>}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              {open.category} · {open.mandatory ? "Mandatory" : "Optional"}
              {open.dueDate ? ` · due ${longDate(open.dueDate)}` : ""} · {done(open)} of {open.assignees.length} completed
            </Text>
            <Box mah={420} style={{ overflow: "auto" }}>
              <Table>
                <Table.Thead bg="gray.0" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <Table.Tr>
                    <Table.Th>Employee</Table.Th>
                    <Table.Th>Branch</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {open.assignees.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {a.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {a.designation}
                        </Text>
                      </Table.Td>
                      <Table.Td>{a.branch}</Table.Td>
                      <Table.Td>
                        {a.status === "COMPLETED" ? (
                          <Box>
                            <Badge color="teal">Completed</Badge>
                            <Text size="xs" c="dimmed">
                              {a.completedOn ? longDate(a.completedOn) : ""} · {a.markedBy}
                            </Text>
                          </Box>
                        ) : (
                          <Badge color="yellow">Pending</Badge>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button size="compact-xs" variant={a.status === "COMPLETED" ? "default" : "filled"} loading={busy === `a-${a.id}`} onClick={() => mark(a, a.status !== "COMPLETED", a.name)}>
                          {a.status === "COMPLETED" ? "Reopen" : "Mark complete"}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
            <Group justify="space-between">
              {isHr ? (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  loading={busy === "del"}
                  onClick={() => run("del", () => api(`/api/training/${open.id}`, "DELETE"), "Training removed.", () => setOpenId(null))}
                >
                  Remove training
                </Button>
              ) : (
                <span />
              )}
              <Button variant="default" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </Group>
          </Stack>
        </Modal>
      ) : null}

      <Modal opened={creating} onClose={() => setCreating(false)} title={<Text fw={600}>New training</Text>} size="md">
        <Stack gap="md">
          <TextInput label="Title" placeholder="e.g. Fair Practices Code refresher" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.currentTarget.value }))} data-autofocus />
          <SimpleGrid cols={2} spacing="md">
            <Select label="Category" data={TRAINING_CATEGORIES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))} />
            <Select label="Who should attend" data={Object.entries(audiences).map(([value, label]) => ({ value, label }))} value={form.audience} onChange={(v) => setForm((f) => ({ ...f, audience: v ?? "ALL" }))} />
            <DatePickerInput label="Due date" placeholder="Optional" clearable value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} valueFormat="DD MMM YYYY" weekendDays={[0]} />
            <Switch label="Mandatory" checked={form.mandatory} onChange={(e) => setForm((f) => ({ ...f, mandatory: e.currentTarget.checked }))} mt={28} />
          </SimpleGrid>
          <Textarea label="Details" placeholder="What it covers, where and how it is held" autosize minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))} />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "create"}
              disabled={!form.title.trim()}
              onClick={() =>
                run("create", () => api("/api/training", "POST", form), `${form.title} assigned to ${audiences[form.audience].toLowerCase()}.`, () => {
                  setCreating(false);
                  setForm((f) => ({ ...f, title: "", description: "", dueDate: null }));
                })
              }
            >
              Create and assign
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
