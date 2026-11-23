"use client";

import { useMemo, useState } from "react";
import { Box, Button, Group, Paper, Select, SimpleGrid, Tabs, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { downloadCsv } from "@/lib/client";
import { longDate, monthLabel, shortDate, timeOf, todayStr, weekday } from "@/lib/dates";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MonthSelect, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";
import { CheckInCard, type TodayAttendance } from "./CheckInCard";
import { RegisterGrid, RegisterLegend, type RegisterRowData } from "./RegisterGrid";

export type BoardRow = {
  id: string;
  name: string;
  code: string;
  designation: string;
  branch: string;
  status: string;
  leaveType: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  location: string | null;
};

export type LogRow = { date: string; checkIn: Date | null; checkOut: Date | null; location: string | null; status: string };

function worked(a: Date | null, b: Date | null) {
  if (!a || !b) return "—";
  const mins = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function AttendanceView({
  role,
  myToday,
  dayOff,
  board,
  register,
  month,
  months,
  myLog,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  myToday: TodayAttendance;
  dayOff: string | null;
  board: BoardRow[];
  register: { days: string[]; rows: RegisterRowData[] };
  month: string;
  months: string[];
  myLog: LogRow[];
}) {
  const [status, setStatus] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const branchNames = useMemo(() => [...new Set(board.map((r) => r.branch))].sort(), [board]);

  const count = (...s: string[]) => board.filter((b) => s.includes(b.status)).length;
  const expectedIn = board.filter((b) => !["ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"].includes(b.status)).length;
  const boardFiltered = board.filter((r) => (status === "ALL" || r.status === status) && (branch === "ALL" || r.branch === branch));
  const registerRows = register.rows.filter((r) => branch === "ALL" || r.branch === branch);

  const boardColumns: Column<BoardRow>[] = [
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
            {r.designation} · {r.code}
          </Text>
        </Box>
      ),
    },
    { key: "branch", header: "Branch", value: (r) => r.branch },
    { key: "in", header: "Check in", value: (r) => (r.checkIn ? new Date(r.checkIn).getTime() : null), render: (r) => timeOf(r.checkIn) },
    { key: "out", header: "Check out", value: (r) => (r.checkOut ? new Date(r.checkOut).getTime() : null), render: (r) => timeOf(r.checkOut) },
    { key: "location", header: "Location", value: (r) => r.location ?? "", render: (r) => <Text size="sm" c="dimmed">{r.location ?? "—"}</Text> },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => (
        <Group gap={6}>
          <StatusBadge status={r.status} />
          {r.leaveType ? (
            <Text size="xs" c="dimmed">
              {r.leaveType}
            </Text>
          ) : null}
        </Group>
      ),
    },
  ];

  const logColumns: Column<LogRow>[] = [
    { key: "date", header: "Date", value: (r) => r.date, render: (r) => `${weekday(r.date)}, ${shortDate(r.date)}` },
    { key: "in", header: "Check in", value: (r) => (r.checkIn ? new Date(r.checkIn).getTime() : null), render: (r) => timeOf(r.checkIn) },
    { key: "out", header: "Check out", value: (r) => (r.checkOut ? new Date(r.checkOut).getTime() : null), render: (r) => timeOf(r.checkOut) },
    { key: "hours", header: "Hours", sortable: false, render: (r) => worked(r.checkIn, r.checkOut) },
    { key: "location", header: "Location", value: (r) => r.location ?? "", render: (r) => <Text size="sm" c="dimmed">{r.location ?? "—"}</Text> },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  function exportRegister() {
    const code: Record<string, string> = { PRESENT: "P", LATE: "L", HALF_DAY: "HD", ON_LEAVE: "LV", ABSENT: "A", HOLIDAY: "H", WEEKLY_OFF: "WO", NOT_IN: "", UPCOMING: "" };
    downloadCsv(
      `attendance-register-${month}.csv`,
      ["Employee", "Code", "Branch", ...register.days.map((d) => d.slice(8)), "Present", "Late", "Leave", "Absent"],
      registerRows.map((r) => [r.name, r.code, r.branch, ...r.days.map((d) => code[d] ?? ""), r.present, r.late, r.leave, r.absent]),
    );
  }

  const branchFilter =
    role === "HR" ? (
      <Select
        w={150}
        aria-label="Branch"
        value={branch}
        onChange={(v) => setBranch(v ?? "ALL")}
        data={[{ value: "ALL", label: "All branches" }, ...branchNames.map((b) => ({ value: b, label: b }))]}
      />
    ) : null;

  if (role === "EMPLOYEE") {
    const mine = register.rows[0];
    return (
      <>
        <PageHeader title="Attendance" subtitle={monthLabel(month)} actions={<MonthSelect months={months} value={month} />} />
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mb="md">
          <CheckInCard today={myToday} dayOff={dayOff} />
          <SimpleGrid cols={4} spacing="md">
            <Stat label="Present" value={mine?.present ?? 0} />
            <Stat label="Late" value={mine?.late ?? 0} tone={mine?.late ? "warn" : "default"} />
            <Stat label="Leave" value={mine?.leave ?? 0} />
            <Stat label="Absent" value={mine?.absent ?? 0} tone={mine?.absent ? "bad" : "default"} />
          </SimpleGrid>
        </SimpleGrid>
        <Paper withBorder mb="md">
          <Group justify="space-between" px="md" py={10}>
            <Text size="sm" fw={600}>
              {monthLabel(month)}
            </Text>
            <RegisterLegend />
          </Group>
          <RegisterGrid days={register.days} rows={register.rows} linkNames={false} />
        </Paper>
        <DataTable rows={myLog} columns={logColumns} rowKey={(r) => r.date} csvName={`my-attendance-${month}`} empty="No attendance recorded this month." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${weekday(todayStr())}, ${longDate(todayStr())}${dayOff ? ` · ${dayOff === "HOLIDAY" ? "company holiday" : "weekly off"}` : ""}`}
      />

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md" mb="md">
        <CheckInCard today={myToday} dayOff={dayOff} />
        <Box style={{ gridColumn: "span 2" }}>
          <SimpleGrid cols={4} spacing="md">
            <Stat label="Present today" value={`${count("PRESENT", "LATE", "HALF_DAY")} / ${expectedIn}`} hint="Checked in" />
            <Stat label="Late" value={count("LATE")} tone={count("LATE") ? "warn" : "default"} hint="After 9:45 am" />
            <Stat label="On leave" value={count("ON_LEAVE")} hint="Approved leave" />
            <Stat label="Not checked in" value={count("NOT_IN")} tone={count("NOT_IN") ? "bad" : "default"} hint="No leave applied" />
          </SimpleGrid>
        </Box>
      </SimpleGrid>

      <Tabs defaultValue="today" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="today">Today</Tabs.Tab>
          <Tabs.Tab value="register">Monthly register</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="today">
          <DataTable
            rows={boardFiltered}
            columns={boardColumns}
            rowKey={(r) => r.id}
            searchPlaceholder="Search employee"
            csvName={`attendance-${todayStr()}`}
            maxHeight={600}
            filters={
              <>
                {branchFilter}
                <Select
                  w={170}
                  aria-label="Status"
                  value={status}
                  onChange={(v) => setStatus(v ?? "ALL")}
                  data={[
                    { value: "ALL", label: "Any status" },
                    { value: "PRESENT", label: "Present" },
                    { value: "LATE", label: "Late" },
                    { value: "ON_LEAVE", label: "On leave" },
                    { value: "NOT_IN", label: "Not checked in" },
                  ]}
                />
              </>
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="register">
          <Paper withBorder>
            <Group justify="space-between" px="sm" py={8} style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
              <Group gap="xs">
                <MonthSelect months={months} value={month} />
                {branchFilter}
              </Group>
              <Group gap="md">
                <RegisterLegend />
                <Button variant="default" leftSection={<IconDownload size={15} />} onClick={exportRegister}>
                  Export CSV
                </Button>
              </Group>
            </Group>
            <RegisterGrid days={register.days} rows={registerRows} />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
