"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Anchor, Avatar, Box, Button, Grid, Group, Paper, SimpleGrid, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { IconChevronLeft, IconPencil } from "@tabler/icons-react";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { LEAVE_TYPES, type LeaveType } from "@/lib/config";
import { longDate, monthLabel, shortDate, timeOf, weekday } from "@/lib/dates";
import { initials, num, pct, rupees, rupeesShort } from "@/lib/format";
import { AchievementBar, Empty, KeyValue, Section, StatusBadge } from "@/components/ui/primitives";
import { RegisterGrid, RegisterLegend, type RegisterRowData } from "./RegisterGrid";
import type { LeaveBalance } from "@/services/leaves";

export type ProfileData = {
  employee: {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    gender: string;
    designation: string;
    department: string;
    branch: string;
    city: string;
    manager: { id: string; name: string; designation: string } | null;
    joinDate: string;
    status: string;
    monthlyCtc: number | null;
    reportCount: number;
    branchId: string;
  };
  /** Set for HR only: lets them edit this employee. */
  branchList: { id: string; name: string }[] | null;
  balances: LeaveBalance[];
  targets: {
    month: string;
    progress: number;
    score: number;
    metrics: { metric: string; label: string; unit: "inr" | "count"; target: number; achieved: number; pct: number }[];
  }[];
  register: { days: string[]; rows: RegisterRowData[]; month: string };
  log: { date: string; checkIn: Date | null; checkOut: Date | null; location: string | null; status: string }[];
  leaves: { id: string; type: string; fromDate: string; toDate: string; days: number; reason: string; status: string; approver: string | null }[];
};

function tenure(joinDate: string) {
  const start = new Date(joinDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "New joiner";
}

export function EmployeeProfileView({ data, showBack }: { data: ProfileData; showBack: boolean }) {
  const e = data.employee;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <>
      {showBack ? (
        <Anchor component={Link} href="/employees" size="sm" c="dimmed" mb="sm" display="inline-flex" style={{ alignItems: "center", gap: 4 }}>
          <IconChevronLeft size={14} /> Employees
        </Anchor>
      ) : null}

      <Paper withBorder p="md" mb="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Avatar size={52} radius="xl" color="brand" variant="light">
              {initials(e.name)}
            </Avatar>
            <Box>
              <Group gap="xs">
                <Title order={1}>{e.name}</Title>
                <StatusBadge status={e.status} />
              </Group>
              <Text size="sm" c="dimmed" mt={2}>
                {e.designation} · {e.department} · {e.branch} branch
              </Text>
            </Box>
          </Group>
          <Group gap="lg" align="center">
            <Box ta="right">
              <Text size="xs" c="dimmed">
                Employee code
              </Text>
              <Text size="sm" fw={600} className="num">
                {e.code}
              </Text>
            </Box>
            {data.branchList ? (
              <Button variant="default" leftSection={<IconPencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
          </Group>
        </Group>
      </Paper>

      {editing && data.branchList ? (
        <EmployeeFormModal
          branches={data.branchList}
          initial={{
            id: e.id,
            name: e.name,
            email: e.email,
            phone: e.phone,
            gender: e.gender,
            designation: e.designation,
            branchId: e.branchId,
            joinDate: e.joinDate,
            monthlyCtc: e.monthlyCtc ?? 0,
            status: e.status,
          }}
          onClose={(saved) => {
            setEditing(false);
            if (saved) router.refresh();
          }}
        />
      ) : null}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Section title="Details">
              <KeyValue
                items={[
                  { label: "Email", value: e.email },
                  { label: "Phone", value: `+91 ${e.phone.slice(0, 5)} ${e.phone.slice(5)}` },
                  { label: "Branch", value: `${e.branch}, ${e.city}` },
                  { label: "Department", value: e.department },
                  {
                    label: "Reports to",
                    value: e.manager ? (
                      <Anchor component={Link} href={`/employees/${e.manager.id}`} size="sm">
                        {e.manager.name}
                      </Anchor>
                    ) : (
                      "—"
                    ),
                  },
                  ...(e.reportCount ? [{ label: "Direct reports", value: e.reportCount }] : []),
                  { label: "Date of joining", value: longDate(e.joinDate) },
                  { label: "Tenure", value: tenure(e.joinDate) },
                  ...(e.monthlyCtc != null ? [{ label: "Monthly CTC", value: rupees(e.monthlyCtc) }] : []),
                ]}
              />
            </Section>

            <Section title="Leave balance">
              <SimpleGrid cols={3} spacing="sm">
                {data.balances.map((b) => (
                  <Box key={b.type}>
                    <Text size="xs" c="dimmed">
                      {b.label}
                    </Text>
                    <Text fz={20} fw={600} className="num">
                      {b.available}
                      <Text span size="xs" c="dimmed" fw={400}>
                        {" "}
                        / {b.allocated}
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {b.used} used{b.pending ? ` · ${b.pending} pending` : ""}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Section>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder>
            <Tabs defaultValue={data.targets.length ? "targets" : "attendance"}>
              <Tabs.List px="sm">
                {data.targets.length ? <Tabs.Tab value="targets">Targets</Tabs.Tab> : null}
                <Tabs.Tab value="attendance">Attendance</Tabs.Tab>
                <Tabs.Tab value="leave">Leave history</Tabs.Tab>
              </Tabs.List>

              {data.targets.length ? (
                <Tabs.Panel value="targets">
                  <Table>
                    <Table.Thead bg="gray.0">
                      <Table.Tr>
                        <Table.Th>Month</Table.Th>
                        <Table.Th>Metric</Table.Th>
                        <Table.Th ta="right">Target</Table.Th>
                        <Table.Th ta="right">Achieved</Table.Th>
                        <Table.Th w={150}>Progress</Table.Th>
                        <Table.Th ta="right">%</Table.Th>
                        <Table.Th ta="right">Score</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.targets.flatMap((t) =>
                        t.metrics.map((m, i) => (
                          <Table.Tr key={`${t.month}-${m.metric}`}>
                            {i === 0 ? (
                              <Table.Td rowSpan={t.metrics.length} style={{ verticalAlign: "top" }}>
                                <Text size="sm" fw={500}>
                                  {monthLabel(t.month)}
                                </Text>
                                {t.progress < 1 ? (
                                  <Text size="xs" c="dimmed">
                                    In progress · {pct(t.progress * 100)} of days
                                  </Text>
                                ) : null}
                              </Table.Td>
                            ) : null}
                            <Table.Td>{m.label}</Table.Td>
                            <Table.Td ta="right">{m.unit === "inr" ? rupeesShort(m.target) : num(m.target)}</Table.Td>
                            <Table.Td ta="right">{m.unit === "inr" ? rupeesShort(m.achieved) : num(m.achieved)}</Table.Td>
                            <Table.Td>
                              <AchievementBar value={m.pct} expected={t.progress < 1 ? t.progress * 100 : undefined} />
                            </Table.Td>
                            <Table.Td ta="right">{pct(m.pct)}</Table.Td>
                            {i === 0 ? (
                              <Table.Td ta="right" fw={600} rowSpan={t.metrics.length} style={{ verticalAlign: "top" }}>
                                {pct(t.score)}
                              </Table.Td>
                            ) : null}
                          </Table.Tr>
                        )),
                      )}
                    </Table.Tbody>
                  </Table>
                </Tabs.Panel>
              ) : null}

              <Tabs.Panel value="attendance">
                <Box p="md" pb="xs">
                  <Group justify="space-between" mb="sm">
                    <Text size="sm" fw={600}>
                      {monthLabel(data.register.month)}
                    </Text>
                    <RegisterLegend />
                  </Group>
                  <Paper withBorder>
                    <RegisterGrid days={data.register.days} rows={data.register.rows} linkNames={false} />
                  </Paper>
                </Box>
                <Table>
                  <Table.Thead bg="gray.0">
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Check in</Table.Th>
                      <Table.Th>Check out</Table.Th>
                      <Table.Th>Location</Table.Th>
                      <Table.Th ta="right">Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.log.map((l) => (
                      <Table.Tr key={l.date}>
                        <Table.Td>
                          {weekday(l.date)}, {shortDate(l.date)}
                        </Table.Td>
                        <Table.Td>{timeOf(l.checkIn)}</Table.Td>
                        <Table.Td>{timeOf(l.checkOut)}</Table.Td>
                        <Table.Td c="dimmed">{l.location ?? "—"}</Table.Td>
                        <Table.Td ta="right">
                          <StatusBadge status={l.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Tabs.Panel>

              <Tabs.Panel value="leave">
                {data.leaves.length ? (
                  <Table>
                    <Table.Thead bg="gray.0">
                      <Table.Tr>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Dates</Table.Th>
                        <Table.Th ta="right">Days</Table.Th>
                        <Table.Th>Reason</Table.Th>
                        <Table.Th>Decided by</Table.Th>
                        <Table.Th ta="right">Status</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.leaves.map((l) => (
                        <Table.Tr key={l.id}>
                          <Table.Td>{LEAVE_TYPES[l.type as LeaveType]?.label ?? l.type}</Table.Td>
                          <Table.Td>
                            {longDate(l.fromDate)}
                            {l.toDate !== l.fromDate ? ` – ${longDate(l.toDate)}` : ""}
                          </Table.Td>
                          <Table.Td ta="right">{l.days}</Table.Td>
                          <Table.Td c="dimmed">{l.reason}</Table.Td>
                          <Table.Td>{l.approver ?? "—"}</Table.Td>
                          <Table.Td ta="right">
                            <StatusBadge status={l.status} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Empty>No leave requests yet.</Empty>
                )}
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
      </Grid>
    </>
  );
}
