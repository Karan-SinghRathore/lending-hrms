"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Box, Button, Checkbox, Group, Modal, Progress, SegmentedControl, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { api, notifyError, notifyOk } from "@/lib/client";
import { longDate, timeOf } from "@/lib/dates";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader, Stat } from "@/components/ui/primitives";

export type CaseRow = {
  id: number;
  employeeId: number;
  name: string;
  code: string;
  designation: string;
  branch: string;
  kind: string;
  startedOn: string;
  tasks: { id: number; title: string; owner: string; done: boolean; doneBy: string | null; doneAt: Date | null }[];
};

const OWNER: Record<string, string> = { HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" };
const doneCount = (c: CaseRow) => c.tasks.filter((t) => t.done).length;

export function OnboardingView({
  role,
  cases,
  employees,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  cases: CaseRow[];
  employees: { id: number; name: string; code: string; branch: string }[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [kind, setKind] = useState("JOINING");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "start" | null>(null);
  const [filter, setFilter] = useState("OPEN");

  const open = cases.find((c) => c.id === openId) ?? null;
  const isOpen = (c: CaseRow) => doneCount(c) < c.tasks.length;
  const visible = cases.filter((c) => filter === "ALL" || (filter === "OPEN" ? isOpen(c) : !isOpen(c)));

  async function toggle(taskId: number, done: boolean) {
    setBusy(taskId);
    try {
      await api(`/api/checklists/tasks/${taskId}`, "PATCH", { done });
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    setBusy("start");
    try {
      const res = await api<{ id: number }>("/api/checklists", "POST", { employeeId: Number(employeeId), kind });
      notifyOk("Checklist started.");
      setStarting(false);
      setEmployeeId(null);
      router.refresh();
      setOpenId(res.id);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<CaseRow>[] = [
    {
      key: "name",
      header: "Employee",
      value: (c) => c.name,
      render: (c) => (
        <Box>
          <Text size="sm" fw={500}>
            {c.name}
          </Text>
          <Text size="xs" c="dimmed">
            {c.designation} · {c.branch} · {c.code}
          </Text>
        </Box>
      ),
    },
    { key: "kind", header: "Checklist", value: (c) => c.kind, render: (c) => <Badge color={c.kind === "JOINING" ? "blue" : "orange"}>{c.kind === "JOINING" ? "Joining" : "Exit"}</Badge> },
    { key: "started", header: "Started", value: (c) => c.startedOn, render: (c) => longDate(c.startedOn) },
    {
      key: "progress",
      header: "Progress",
      width: 220,
      value: (c) => doneCount(c) / c.tasks.length,
      render: (c) => (
        <Group gap="xs" wrap="nowrap">
          <Progress value={(doneCount(c) / c.tasks.length) * 100} size={6} radius="xs" color={isOpen(c) ? "brand" : "teal"} style={{ flex: 1 }} />
          <Text size="xs" c="dimmed" className="num" w={36} ta="right">
            {doneCount(c)}/{c.tasks.length}
          </Text>
        </Group>
      ),
    },
    {
      key: "pending",
      header: "Waiting on",
      sortable: false,
      value: (c) => [...new Set(c.tasks.filter((t) => !t.done).map((t) => OWNER[t.owner]))].join(", ") || "Complete",
    },
    {
      key: "open",
      header: "",
      noExport: true,
      align: "right",
      render: (c) => (
        <Button size="compact-xs" variant="default" onClick={() => setOpenId(c.id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={role === "EMPLOYEE" ? "My onboarding" : "Onboarding & exit"}
        subtitle="Joining and exit checklists, with who has to complete each step"
        actions={
          role === "HR" ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setStarting(true)}>
              Start checklist
            </Button>
          ) : null
        }
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
        <Stat label="In progress" value={cases.filter(isOpen).length} />
        <Stat label="Joining" value={cases.filter((c) => c.kind === "JOINING" && isOpen(c)).length} hint="Open joining checklists" />
        <Stat label="Exit" value={cases.filter((c) => c.kind === "EXIT" && isOpen(c)).length} hint="Open exit checklists" />
        <Stat label="Completed" value={cases.filter((c) => !isOpen(c)).length} />
      </SimpleGrid>

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(c) => c.id}
        searchPlaceholder={role === "EMPLOYEE" ? undefined : "Search employee"}
        empty={role === "EMPLOYEE" ? "You have no checklist to complete." : "No checklists here."}
        filters={
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={setFilter}
            data={[
              { value: "OPEN", label: "In progress" },
              { value: "DONE", label: "Completed" },
              { value: "ALL", label: "All" },
            ]}
          />
        }
      />

      {open ? (
        <Modal opened onClose={() => setOpenId(null)} size="lg" title={<Text fw={600}>{open.kind === "JOINING" ? "Joining" : "Exit"} checklist · {open.name}</Text>}>
          <Stack gap="sm">
            <Group gap="xs">
              <Progress value={(doneCount(open) / open.tasks.length) * 100} size={6} radius="xs" style={{ flex: 1 }} color={isOpen(open) ? "brand" : "teal"} />
              <Text size="xs" c="dimmed" className="num">
                {doneCount(open)} of {open.tasks.length} done
              </Text>
            </Group>
            {open.tasks.map((t) => {
              const allowed = role !== "EMPLOYEE" || t.owner === "EMPLOYEE";
              return (
                <Group key={t.id} justify="space-between" wrap="nowrap" py={6} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
                  <Checkbox
                    checked={t.done}
                    disabled={!allowed || busy === t.id}
                    onChange={(e) => toggle(t.id, e.currentTarget.checked)}
                    label={
                      <Box>
                        <Text size="sm" td={t.done ? "line-through" : undefined} c={t.done ? "dimmed" : undefined}>
                          {t.title}
                        </Text>
                        {t.done && t.doneBy ? (
                          <Text size="xs" c="dimmed">
                            {t.doneBy} · {t.doneAt ? `${longDate(new Date(t.doneAt).toLocaleDateString("en-CA"))}, ${timeOf(t.doneAt)}` : ""}
                          </Text>
                        ) : null}
                      </Box>
                    }
                  />
                  <Badge color="gray">{OWNER[t.owner]}</Badge>
                </Group>
              );
            })}
            <Group justify="space-between" mt={4}>
              <Text size="xs" c="dimmed">
                Each tick is saved straight away. You can close this and continue later.
                {role === "EMPLOYEE" ? " You can tick the steps marked Employee; HR and your manager complete the rest." : ""}
              </Text>
              <Button variant="default" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </Group>
          </Stack>
        </Modal>
      ) : null}

      <Modal opened={starting} onClose={() => setStarting(false)} title={<Text fw={600}>Start checklist</Text>} size="sm">
        <Stack gap="md">
          <SegmentedControl
            value={kind}
            onChange={setKind}
            data={[
              { value: "JOINING", label: "Joining" },
              { value: "EXIT", label: "Exit" },
            ]}
          />
          <Select
            label="Employee"
            placeholder="Search by name"
            searchable
            value={employeeId}
            onChange={setEmployeeId}
            data={employees.map((e) => ({ value: String(e.id), label: `${e.name} · ${e.branch}` }))}
          />
          <Text size="xs" c="dimmed">
            New employees get a joining checklist automatically when they are added.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setStarting(false)}>
              Cancel
            </Button>
            <Button onClick={start} loading={busy === "start"} disabled={!employeeId}>
              Start
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
