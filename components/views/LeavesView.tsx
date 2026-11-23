"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionIcon, Badge, Box, Button, Group, Modal, Paper, Select, SimpleGrid, Stack, Switch, Table, Tabs, Text, TextInput, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCheck, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { LEAVE_TYPES, type LeaveType } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { isSunday, longDate, shortDate, todayStr, weekday, workingDaysBetween } from "@/lib/dates";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Empty, PageHeader, StatusBadge } from "@/components/ui/primitives";
import type { LeaveBalance } from "@/services/leaves";

export type LeaveRow = {
  id: string;
  employeeId: string;
  name: string;
  code: string;
  branch: string;
  designation: string;
  type: string;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: string;
  approver: string | null;
  remark: string | null;
  appliedOn: string;
};

type Holiday = { id: string; date: string; name: string };

const typeLabel = (t: string) => LEAVE_TYPES[t as LeaveType]?.label ?? t;
const dateRange = (r: { fromDate: string; toDate: string; halfDay: boolean }) =>
  r.halfDay ? `${shortDate(r.fromDate)} (half day)` : r.fromDate === r.toDate ? shortDate(r.fromDate) : `${shortDate(r.fromDate)} – ${shortDate(r.toDate)}`;

function ApplyModal({ balances, holidays, onClose }: { balances: LeaveBalance[]; holidays: Holiday[]; onClose: (saved: boolean) => void }) {
  const [type, setType] = useState<string>("CL");
  const [range, setRange] = useState<[string | null, string | null]>([null, null]);
  const [single, setSingle] = useState<string | null>(null);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const holidaySet = new Set(holidays.map((h) => h.date));
  const from = halfDay ? single : range[0];
  const to = halfDay ? single : (range[1] ?? range[0]);
  const days = from && to ? (halfDay ? (workingDaysBetween(from, from, holidaySet).length ? 0.5 : 0) : workingDaysBetween(from, to, holidaySet).length) : 0;
  const balance = balances.find((b) => b.type === type);
  const short = balance ? days > balance.available : false;

  async function submit() {
    setSaving(true);
    try {
      await api("/api/leaves", "POST", { type, fromDate: from, toDate: to, halfDay, reason });
      notifyOk("Leave request sent to your manager.");
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  const excludeDate = (d: string) => isSunday(d) || holidaySet.has(d);

  return (
    <Modal opened onClose={() => onClose(false)} title={<Text fw={600}>Apply for leave</Text>} size="md">
      <Stack gap="md">
        <Select
          label="Leave type"
          value={type}
          onChange={(v) => setType(v ?? "CL")}
          data={balances.map((b) => ({ value: b.type, label: `${b.label} · ${b.available} day${b.available === 1 ? "" : "s"} available` }))}
        />
        <Switch label="Half day" checked={halfDay} onChange={(e) => setHalfDay(e.currentTarget.checked)} />
        {halfDay ? (
          <DatePickerInput label="Date" placeholder="Pick a date" value={single} onChange={setSingle} minDate={todayStr()} excludeDate={excludeDate} weekendDays={[0]} valueFormat="DD MMM YYYY" popoverProps={{ withinPortal: true }} />
        ) : (
          <DatePickerInput type="range" label="Dates" placeholder="From – to" value={range} onChange={setRange} minDate={todayStr()} excludeDate={excludeDate} weekendDays={[0]} allowSingleDateInRange valueFormat="DD MMM YYYY" popoverProps={{ withinPortal: true }} />
        )}
        <Textarea label="Reason" placeholder="A short note for your manager" value={reason} onChange={(e) => setReason(e.currentTarget.value)} autosize minRows={2} />

        <Paper bg="gray.0" p="sm" radius="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Leave days (Sundays and holidays not counted)
            </Text>
            <Text size="sm" fw={600} className="num">
              {days || "—"}
            </Text>
          </Group>
          {short ? (
            <Text size="xs" c="red.8" mt={4}>
              Only {balance!.available} {balance!.label.toLowerCase()} day(s) available.
            </Text>
          ) : null}
        </Paper>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!days || short || !reason.trim()}>
            Send request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function RejectModal({ row, onClose }: { row: LeaveRow; onClose: (saved: boolean) => void }) {
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  async function reject() {
    setSaving(true);
    try {
      await api(`/api/leaves/${row.id}`, "PATCH", { action: "REJECT", remark });
      notifyOk(`Rejected ${row.name}'s leave.`);
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal opened onClose={() => onClose(false)} title={<Text fw={600}>Reject leave · {row.name}</Text>} size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {typeLabel(row.type)} · {dateRange(row)} · {row.days} day(s)
        </Text>
        <Textarea label="Reason for rejecting" placeholder="Shown to the employee" value={remark} onChange={(e) => setRemark(e.currentTarget.value)} autosize minRows={2} data-autofocus />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={reject} loading={saving} disabled={!remark.trim()}>
            Reject leave
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function LeavesView({
  role,
  balances,
  mine,
  queue,
  all,
  holidays,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  balances: LeaveBalance[];
  mine: LeaveRow[];
  queue: LeaveRow[];
  all: LeaveRow[];
  holidays: Holiday[];
}) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const canApprove = role !== "EMPLOYEE";
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayName, setHolidayName] = useState("");
  const [holidayBusy, setHolidayBusy] = useState(false);

  async function addHoliday() {
    setHolidayBusy(true);
    try {
      await api("/api/holidays", "POST", { date: holidayDate, name: holidayName });
      notifyOk(`${holidayName} added to the calendar.`);
      setHolidayDate(null);
      setHolidayName("");
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setHolidayBusy(false);
    }
  }

  async function removeHoliday(h: Holiday) {
    setHolidayBusy(true);
    try {
      await api(`/api/holidays/${h.id}`, "DELETE");
      notifyOk(`${h.name} removed.`);
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setHolidayBusy(false);
    }
  }
  const today = todayStr();

  async function act(row: LeaveRow, action: "APPROVE" | "CANCEL") {
    setBusyId(row.id);
    try {
      await api(`/api/leaves/${row.id}`, "PATCH", { action });
      notifyOk(action === "APPROVE" ? `Approved ${row.name}'s leave. Balance updated.` : "Request cancelled.");
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusyId(null);
    }
  }

  const queueColumns: Column<LeaveRow>[] = [
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
    { key: "type", header: "Type", value: (r) => typeLabel(r.type) },
    { key: "dates", header: "Dates", value: (r) => r.fromDate, render: dateRange },
    { key: "days", header: "Days", align: "right", value: (r) => r.days },
    { key: "reason", header: "Reason", value: (r) => r.reason, sortable: false, render: (r) => <Text size="sm" c="dimmed">{r.reason}</Text> },
    { key: "applied", header: "Applied", value: (r) => r.appliedOn, render: (r) => shortDate(r.appliedOn) },
    {
      key: "actions",
      header: "",
      noExport: true,
      align: "right",
      width: 210,
      render: (r) => (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          <Button size="xs" color="teal" leftSection={<IconCheck size={14} />} loading={busyId === r.id} onClick={() => act(r, "APPROVE")}>
            Approve
          </Button>
          <Button size="xs" variant="default" leftSection={<IconX size={14} />} disabled={busyId === r.id} onClick={() => setRejecting(r)}>
            Reject
          </Button>
        </Group>
      ),
    },
  ];

  const historyColumns = (withEmployee: boolean, withCancel: boolean): Column<LeaveRow>[] => [
    ...(withEmployee
      ? [
          {
            key: "name",
            header: "Employee",
            value: (r: LeaveRow) => r.name,
            render: (r: LeaveRow) => (
              <Box>
                <Text size="sm" fw={500}>
                  {r.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {r.branch}
                </Text>
              </Box>
            ),
          },
        ]
      : []),
    { key: "type", header: "Type", value: (r) => typeLabel(r.type) },
    { key: "dates", header: "Dates", value: (r) => r.fromDate, render: dateRange },
    { key: "days", header: "Days", align: "right", value: (r) => r.days },
    { key: "reason", header: "Reason", value: (r) => r.reason, sortable: false, render: (r) => <Text size="sm" c="dimmed">{r.reason}</Text> },
    { key: "approver", header: "Decided by", value: (r) => r.approver ?? "—" },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => (
        <Box>
          <StatusBadge status={r.status} />
          {r.remark ? (
            <Text size="xs" c="dimmed" mt={2}>
              {r.remark}
            </Text>
          ) : null}
        </Box>
      ),
    },
    ...(withCancel
      ? [
          {
            key: "cancel",
            header: "",
            noExport: true,
            align: "right" as const,
            render: (r: LeaveRow) =>
              r.status === "PENDING" ? (
                <Button size="xs" variant="subtle" color="gray" loading={busyId === r.id} onClick={() => act(r, "CANCEL")}>
                  Cancel
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  const allFiltered = all.filter((r) => status === "ALL" || r.status === status);

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle={canApprove ? `${queue.length} request${queue.length === 1 ? "" : "s"} waiting for your approval` : "Apply for leave and track your requests"}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setApplying(true)}>
            Apply for leave
          </Button>
        }
      />

      <Tabs defaultValue={canApprove ? "approvals" : "mine"} keepMounted={false}>
        <Tabs.List mb="md">
          {canApprove ? (
            <Tabs.Tab value="approvals" rightSection={queue.length ? <Badge size="xs" variant="filled" color="brand" circle>{queue.length}</Badge> : null}>
              Approvals
            </Tabs.Tab>
          ) : null}
          <Tabs.Tab value="mine">My leave</Tabs.Tab>
          {canApprove ? <Tabs.Tab value="all">{role === "HR" ? "All requests" : "Branch requests"}</Tabs.Tab> : null}
          <Tabs.Tab value="holidays">Holiday calendar</Tabs.Tab>
        </Tabs.List>

        {canApprove ? (
          <Tabs.Panel value="approvals">
            <DataTable rows={queue} columns={queueColumns} rowKey={(r) => r.id} empty="No leave requests are waiting for you." />
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel value="mine">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
            {balances.map((b) => (
              <Paper withBorder p="md" key={b.type}>
                <Text size="xs" c="dimmed" fw={500}>
                  {b.label}
                </Text>
                <Text fz={24} fw={600} className="num" mt={4} lh={1.2}>
                  {b.available}
                  <Text span size="sm" c="dimmed" fw={400}>
                    {" "}
                    of {b.allocated} days left
                  </Text>
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {b.used} used{b.pending ? ` · ${b.pending} awaiting approval` : ""}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
          <DataTable rows={mine} columns={historyColumns(false, true)} rowKey={(r) => r.id} empty="You haven't applied for leave yet." />
        </Tabs.Panel>

        {canApprove ? (
          <Tabs.Panel value="all">
            <DataTable
              rows={allFiltered}
              columns={historyColumns(true, false)}
              rowKey={(r) => r.id}
              searchPlaceholder="Search employee or reason"
              csvName="leave-requests"
              filters={
                <Select
                  w={150}
                  aria-label="Status"
                  value={status}
                  onChange={(v) => setStatus(v ?? "ALL")}
                  data={[
                    { value: "ALL", label: "Any status" },
                    { value: "PENDING", label: "Pending" },
                    { value: "APPROVED", label: "Approved" },
                    { value: "REJECTED", label: "Rejected" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ]}
                />
              }
            />
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel value="holidays">
          <Paper withBorder maw={640}>
            {role === "HR" ? (
              <Group gap="xs" p="sm" align="flex-end" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
                <DatePickerInput label="Date" placeholder="Pick a date" w={160} value={holidayDate} onChange={setHolidayDate} valueFormat="DD MMM YYYY" weekendDays={[0]} />
                <TextInput label="Holiday name" placeholder="e.g. Makar Sankranti" style={{ flex: 1 }} value={holidayName} onChange={(e) => setHolidayName(e.currentTarget.value)} />
                <Button onClick={addHoliday} loading={holidayBusy} disabled={!holidayDate || !holidayName.trim()}>
                  Add holiday
                </Button>
              </Group>
            ) : null}
            {holidays.length ? (
              <Table>
                <Table.Thead bg="gray.0">
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Day</Table.Th>
                    <Table.Th>Holiday</Table.Th>
                    {role === "HR" ? <Table.Th w={40} /> : null}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {holidays.map((h) => (
                    <Table.Tr key={h.date} style={{ opacity: h.date < today ? 0.5 : 1 }}>
                      <Table.Td>{longDate(h.date)}</Table.Td>
                      <Table.Td>{weekday(h.date)}</Table.Td>
                      <Table.Td fw={500}>{h.name}</Table.Td>
                      {role === "HR" ? (
                        <Table.Td>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Remove ${h.name}`} disabled={holidayBusy} onClick={() => removeHoliday(h)}>
                            <IconTrash size={15} />
                          </ActionIcon>
                        </Table.Td>
                      ) : null}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Empty>No holidays added.</Empty>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {applying ? (
        <ApplyModal
          balances={balances}
          holidays={holidays}
          onClose={(saved) => {
            setApplying(false);
            if (saved) router.refresh();
          }}
        />
      ) : null}
      {rejecting ? (
        <RejectModal
          row={rejecting}
          onClose={(saved) => {
            setRejecting(null);
            if (saved) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
