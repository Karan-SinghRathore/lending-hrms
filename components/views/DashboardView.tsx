"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Anchor,
  Badge,
  Box,
  Grid,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconBriefcase, IconCalendarEvent, IconCash, IconClockCheck, IconCoinRupee, IconHourglass, IconReceiptRupee, IconTargetArrow, IconUsers } from "@tabler/icons-react";
import { BarChart, DonutChart } from "@mantine/charts";
import { LEAVE_TYPES, type LeaveType } from "@/lib/config";
import {
  longDate,
  monthLabel,
  shortDate,
  todayStr,
  weekday,
} from "@/lib/dates";
import { pct, rupees, rupeesShort, num } from "@/lib/format";
import {
  AchievementBar,
  GroupLabel,
  Empty,
  PageHeader,
  Section,
  StandingBadge,
  Stat,
  StatusBadge,
} from "@/components/ui/primitives";
import { CheckInCard, type TodayAttendance } from "./CheckInCard";
import type { BranchSummary, ScoreRow } from "@/services/targets";
import type { LeaveBalance } from "@/services/leaves";

type Holiday = { date: string; name: string };

export type TeamDashboardData = {
  month: string;
  headcount: number;
  branchCount: number;
  attendance: {
    present: number;
    late: number;
    notIn: number;
    expectedIn: number;
    dayOff: string | null;
  };
  onLeave: {
    id: number;
    employeeId: number;
    name: string;
    branch: string;
    designation: string;
    type: string;
    toDate: string;
  }[];
  pendingApprovals: number;
  progress: number;
  totals: {
    disbursalTarget: number;
    disbursalAchieved: number;
    collectionTarget: number;
    collectionAchieved: number;
  };
  standing: { onTrack: number; atRisk: number; behind: number };
  branches: BranchSummary[];
  top: ScoreRow[];
  bottom: ScoreRow[];
  team: ScoreRow[];
  holidays: Holiday[];
  incentiveEstimate: number;
  lateToday: string[];
  joiners: number;
  recruitment: {
    openPositions: number;
    seats: number;
    pipeline: number;
    offers: number;
  } | null;
  payroll: { month: string; net: number; status: string } | null;
  actions: { label: string; count: number; href: string }[];
  charts: {
    attendanceTrend: { date: string; present: number; pct: number }[];
    departments: { name: string; count: number }[];
    leaveByType: { type: string; days: number }[];
    year: string;
  };
};

function PerformerTable({ rows }: { rows: ScoreRow[] }) {
  if (!rows.length) return <Empty>No targets set for this month.</Empty>;
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={36}>#</Table.Th>
          <Table.Th>Employee</Table.Th>
          <Table.Th>Branch</Table.Th>
          <Table.Th ta="right">Done</Table.Th>
          <Table.Th ta="right">Projected</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.employeeId}>
            <Table.Td c="dimmed">{r.rank}</Table.Td>
            <Table.Td>
              <Anchor
                component={Link}
                href={`/employees/${r.employeeId}`}
                size="sm"
                fw={500}
                c="dark"
              >
                {r.name}
              </Anchor>
              <Text size="xs" c="dimmed">
                {r.designation}
              </Text>
            </Table.Td>
            <Table.Td>{r.branch}</Table.Td>
            <Table.Td ta="right">{pct(r.score)}</Table.Td>
            <Table.Td ta="right" fw={600}>
              {pct(r.projected)}
            </Table.Td>
            <Table.Td ta="right">
              <StandingBadge standing={r.standing} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function TeamDashboard({
  data,
  scopeLabel,
  isHr,
}: {
  data: TeamDashboardData;
  scopeLabel: string;
  isHr: boolean;
}) {
  const [chartMetric, setChartMetric] = useState<"disbursal" | "collection">(
    "disbursal",
  );
  const expected = data.progress * 100;
  const a = data.attendance;
  const attendancePct = a.expectedIn ? (a.present / a.expectedIn) * 100 : 0;
  const disbPct = data.totals.disbursalTarget
    ? (data.totals.disbursalAchieved / data.totals.disbursalTarget) * 100
    : 0;
  const collPct = data.totals.collectionTarget
    ? (data.totals.collectionAchieved / data.totals.collectionTarget) * 100
    : 0;

  // Branch comparison for HR; person-by-person for a branch manager.
  const chartData = isHr
    ? data.branches.map((b) => ({
        name: b.branch,
        Target: Math.round(
          (chartMetric === "disbursal"
            ? b.disbursalTarget
            : b.collectionTarget) / 1e5,
        ),
        Achieved: Math.round(
          (chartMetric === "disbursal"
            ? b.disbursalAchieved
            : b.collectionAchieved) / 1e5,
        ),
      }))
    : data.team
        .filter(
          (r) =>
            r.plan === (chartMetric === "disbursal" ? "SALES" : "COLLECTION"),
        )
        .map((r) => ({
          name: r.name.split(" ")[0],
          Target: Math.round(r.metrics[0].target / 1e5),
          Achieved: Math.round(r.metrics[0].achieved / 1e5),
        }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${scopeLabel} · ${weekday(todayStr())}, ${longDate(todayStr())}`}
      />

      <GroupLabel>Today</GroupLabel>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="lg">
        <Stat
          label="Active employees"
          icon={<IconUsers size={18} stroke={1.5} />}
          value={num(data.headcount)}
          hint={`${isHr ? `${data.branchCount} branches` : scopeLabel} · ${data.joiners} joined this month`}
        />
        <Stat
          label="Present today"
          icon={<IconClockCheck size={18} stroke={1.5} />}
          value={a.dayOff ? "—" : `${a.present} / ${a.expectedIn}`}
          progress={a.dayOff ? undefined : { value: attendancePct }}
          hint={a.dayOff ? (a.dayOff === "HOLIDAY" ? "Company holiday" : "Weekly off") : `${a.late} late · ${a.notIn} not checked in`}
        />
        <Stat label="On leave today" icon={<IconCalendarEvent size={18} stroke={1.5} />} value={data.onLeave.length} hint="Approved leave" />
        <Stat
          label="Leave awaiting approval"
          icon={<IconHourglass size={18} stroke={1.5} />}
          value={data.pendingApprovals}
          tone={data.pendingApprovals ? "warn" : "default"}
          hint={
            data.pendingApprovals ? (
              <Anchor component={Link} href="/leaves" size="xs">
                Review requests
              </Anchor>
            ) : (
              "Nothing pending"
            )
          }
        />
      </SimpleGrid>

      <GroupLabel>{monthLabel(data.month)} · {pct(expected)} of working days done</GroupLabel>
      <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="lg">
        <Stat
          label="Disbursal"
          icon={<IconTargetArrow size={18} stroke={1.5} />}
          value={pct(disbPct)}
          tone={disbPct >= expected ? "good" : disbPct >= expected * 0.85 ? "warn" : "bad"}
          progress={{ value: disbPct, expected }}
          hint={`${rupeesShort(data.totals.disbursalAchieved)} of ${rupeesShort(data.totals.disbursalTarget)}`}
        />
        <Stat
          label="Collection"
          icon={<IconCoinRupee size={18} stroke={1.5} />}
          value={pct(collPct)}
          tone={collPct >= expected ? "good" : collPct >= expected * 0.85 ? "warn" : "bad"}
          progress={{ value: collPct, expected }}
          hint={`${rupeesShort(data.totals.collectionAchieved)} of ${rupeesShort(data.totals.collectionTarget)}`}
        />
        <Stat label="Incentive estimate" icon={<IconCash size={18} stroke={1.5} />} value={rupees(data.incentiveEstimate)} hint="At the current pace" />
        {data.recruitment ? (
          <Stat
            label="Open positions"
            icon={<IconBriefcase size={18} stroke={1.5} />}
            value={data.recruitment.openPositions}
            hint={`${data.recruitment.seats} seats · ${data.recruitment.pipeline} in pipeline · ${data.recruitment.offers} offer${data.recruitment.offers === 1 ? "" : "s"} out`}
          />
        ) : (
          <Stat
            label="Late today"
            icon={<IconClockCheck size={18} stroke={1.5} />}
            value={data.lateToday.length}
            tone={data.lateToday.length ? "warn" : "default"}
            hint={data.lateToday.slice(0, 2).join(", ") || "Everyone on time"}
          />
        )}
        {data.payroll ? (
          <Stat
            label={`Payroll · ${monthLabel(data.payroll.month)}`}
            icon={<IconReceiptRupee size={18} stroke={1.5} />}
            value={data.payroll.status === "NONE" ? "Not run" : rupeesShort(data.payroll.net)}
            tone={data.payroll.status === "PAID" ? "good" : "warn"}
            hint={
              data.payroll.status === "PAID" ? (
                "Paid"
              ) : data.payroll.status === "DRAFT" ? (
                "Draft, not released"
              ) : (
                <Anchor component={Link} href="/payroll" size="xs">
                  Run payroll
                </Anchor>
              )
            }
          />
        ) : (
          <Stat label="On track for target" icon={<IconTargetArrow size={18} stroke={1.5} />} value={`${data.standing.onTrack} of ${data.team.length}`} tone="good" hint="Projected 100% or more" />
        )}
      </SimpleGrid>

      <Grid gutter="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <Section
              title={`${isHr ? "Branch" : "Team"} target vs achieved · ${monthLabel(data.month)}`}
              right={
                <SegmentedControl
                  size="xs"
                  value={chartMetric}
                  onChange={(v) =>
                    setChartMetric(v as "disbursal" | "collection")
                  }
                  data={[
                    { value: "disbursal", label: "Disbursal" },
                    { value: "collection", label: "Collection" },
                  ]}
                />
              }
            >
              <BarChart
                h={318}
                data={chartData}
                dataKey="name"
                series={[
                  { name: "Target", color: "gray.4" },
                  { name: "Achieved", color: "brand.7" },
                ]}
                valueFormatter={(v) => `₹${v} L`}
                barProps={{ radius: 2 }}
                gridAxis="y"
                tickLine="none"
                withLegend
                legendProps={{ verticalAlign: "bottom", height: 36 }}
              />
              <Group gap="lg" mt="xs">
                <Text size="xs" c="dimmed">
                  Disbursal {rupeesShort(data.totals.disbursalAchieved)} /{" "}
                  {rupeesShort(data.totals.disbursalTarget)} ({pct(disbPct)})
                </Text>
                <Text size="xs" c="dimmed">
                  Collection {rupeesShort(data.totals.collectionAchieved)} /{" "}
                  {rupeesShort(data.totals.collectionTarget)} ({pct(collPct)})
                </Text>
                <Text size="xs" c="dimmed">
                  {pct(expected)} of working days done
                </Text>
              </Group>
            </Section>
            <Section title="Target standing · projected month end">
              <Group gap="xl">
                {(
                  [
                    ["On track", data.standing.onTrack, "teal"],
                    ["At risk", data.standing.atRisk, "yellow"],
                    ["Behind", data.standing.behind, "red"],
                  ] as const
                ).map(([label, count, color]) => (
                  <Group key={label} gap={8}>
                    <Group gap={8}>
                      <Box
                        w={8}
                        h={8}
                        bg={`${color}.6`}
                        style={{ borderRadius: 2 }}
                      />
                      <Text size="sm">{label}</Text>
                    </Group>
                    <Text size="sm" fw={600} className="num">
                      {count}
                    </Text>
                  </Group>
                ))}
              </Group>
            </Section>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {data.actions.length ? (
              <Section title="Pending actions" flush>
                <Table>
                  <Table.Tbody>
                    {data.actions.map((a) => (
                      <Table.Tr key={a.label}>
                        <Table.Td>
                          <Anchor
                            component={Link}
                            href={a.href}
                            size="sm"
                            c="dark"
                          >
                            {a.label}
                          </Anchor>
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {a.count}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Section>
            ) : null}
            <Section title="On leave today" flush>
              {data.onLeave.length ? (
                <Table>
                  <Table.Tbody>
                    {data.onLeave.map((l) => (
                      <Table.Tr key={l.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {l.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {l.designation} · {l.branch}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Badge color="blue">{l.type}</Badge>
                          <Text size="xs" c="dimmed" mt={2}>
                            {l.toDate === todayStr()
                              ? "Back tomorrow"
                              : `Till ${shortDate(l.toDate)}`}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Empty>Nobody is on leave today.</Empty>
              )}
            </Section>
          </Stack>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md" mb="md">
        <Section title="Attendance % · last 12 working days">
          <BarChart
            h={200}
            data={data.charts.attendanceTrend.map((d) => ({ day: shortDate(d.date).slice(0, 2), Present: d.pct }))}
            dataKey="day"
            series={[{ name: "Present", color: "brand.7" }]}
            yAxisProps={{ domain: [0, 100] }}
            valueFormatter={(v) => `${v}%`}
            gridAxis="y"
            tickLine="none"
            barProps={{ radius: 2 }}
          />
        </Section>
        <Section title="Headcount by department">
          <BarChart
            h={200}
            data={data.charts.departments.map((d) => ({ department: d.name, People: d.count }))}
            dataKey="department"
            orientation="vertical"
            series={[{ name: "People", color: "brand.7" }]}
            yAxisProps={{ width: 130 }}
            gridAxis="x"
            tickLine="none"
            barProps={{ radius: 2 }}
          />
        </Section>
        <Section title={`Leave days taken · ${data.charts.year}`}>
          <Group justify="center" gap="xl" h={200}>
            <DonutChart
              size={150}
              thickness={22}
              withTooltip
              chartLabel={`${data.charts.leaveByType.reduce((s, l) => s + l.days, 0)} days`}
              data={data.charts.leaveByType.map((l) => ({
                name: LEAVE_TYPES[l.type as LeaveType]?.label ?? l.type,
                value: l.days,
                color: l.type === "CL" ? "brand.7" : l.type === "SL" ? "teal.6" : "yellow.6",
              }))}
            />
            <Stack gap={8}>
              {data.charts.leaveByType.map((l) => (
                <Group key={l.type} gap={8}>
                  <Box w={8} h={8} bg={l.type === "CL" ? "brand.7" : l.type === "SL" ? "teal.6" : "yellow.6"} style={{ borderRadius: 2 }} />
                  <Text size="sm">{LEAVE_TYPES[l.type as LeaveType]?.label ?? l.type}</Text>
                  <Text size="sm" fw={600} className="num">
                    {l.days}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Group>
        </Section>
      </SimpleGrid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Section
            title="Top performers"
            right={
              <Anchor component={Link} href="/targets" size="xs">
                All targets
              </Anchor>
            }
            flush
          >
            <PerformerTable rows={data.top} />
          </Section>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Section
            title="Needs attention"
            right={
              <Anchor component={Link} href="/targets" size="xs">
                All targets
              </Anchor>
            }
            flush
          >
            <PerformerTable rows={data.bottom} />
          </Section>
        </Grid.Col>
      </Grid>
    </>
  );
}

export type MyDashboardData = {
  month: string;
  progress: number;
  score: ScoreRow | null;
  history: { month: string; score: number; incentive: number; rank: number }[];
  balances: LeaveBalance[];
  requests: {
    id: number;
    type: string;
    fromDate: string;
    toDate: string;
    days: number;
    status: string;
  }[];
  today: TodayAttendance;
  monthAttendance: { present: number; late: number };
  holidays: Holiday[];
};

export function MyDashboard({
  data,
  name,
  subtitle,
}: {
  data: MyDashboardData;
  name: string;
  subtitle: string;
}) {
  const expected = data.progress * 100;
  const s = data.score;
  return (
    <>
      <PageHeader title={name} subtitle={subtitle} />

      <Grid gutter="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="md">
            <CheckInCard today={data.today} />
            <Section
              title={`My targets · ${monthLabel(data.month)}`}
              right={s ? <StandingBadge standing={s.standing} /> : null}
            >
              {s ? (
                <Stack gap="md">
                  {s.metrics.map((m) => (
                    <Box key={m.metric}>
                      <Group justify="space-between" mb={6}>
                        <Text size="sm" fw={500}>
                          {m.label}
                        </Text>
                        <Text size="sm" className="num">
                          <b>
                            {m.unit === "inr"
                              ? rupeesShort(m.achieved)
                              : num(m.achieved)}
                          </b>
                          <Text span c="dimmed">
                            {" "}
                            of{" "}
                            {m.unit === "inr"
                              ? rupeesShort(m.target)
                              : num(m.target)}{" "}
                            · {pct(m.pct)}
                          </Text>
                        </Text>
                      </Group>
                      <AchievementBar
                        value={m.pct}
                        expected={expected}
                        w="100%"
                      />
                    </Box>
                  ))}
                  <Text size="xs" c="dimmed">
                    The marker shows where you should be today ({pct(expected)}{" "}
                    of working days done). Rank {s.rank} in your plan this
                    month.
                  </Text>
                </Stack>
              ) : (
                <Empty>No targets set for this month.</Empty>
              )}
            </Section>

            {data.history.length ? (
              <Section
                title="Previous months"
                right={
                  <Anchor component={Link} href="/incentives" size="xs">
                    Incentive details
                  </Anchor>
                }
                flush
              >
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Month</Table.Th>
                      <Table.Th ta="right">Final score</Table.Th>
                      <Table.Th ta="right">Rank</Table.Th>
                      <Table.Th ta="right">Incentive earned</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.history.map((h) => (
                      <Table.Tr key={h.month}>
                        <Table.Td>{monthLabel(h.month)}</Table.Td>
                        <Table.Td ta="right">{pct(h.score, 1)}</Table.Td>
                        <Table.Td ta="right">{h.rank}</Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {h.incentive ? rupees(h.incentive) : "—"}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Section>
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <Stat
                label="Projected incentive"
                value={s ? rupees(s.incentive) : "—"}
                hint={
                  s
                    ? `At ${pct(s.projected)} projected score`
                    : "No incentive plan"
                }
                tone={s && s.incentive > 0 ? "good" : "default"}
              />
              <Stat
                label="Days present this month"
                value={data.monthAttendance.present}
                hint={`${data.monthAttendance.late} late mark${data.monthAttendance.late === 1 ? "" : "s"}`}
              />
            </SimpleGrid>

            <Section
              title="Leave balance"
              right={
                <Anchor component={Link} href="/leaves" size="xs">
                  Apply for leave
                </Anchor>
              }
            >
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
                  </Box>
                ))}
              </SimpleGrid>
            </Section>

            <Section title="My recent leave" flush>
              {data.requests.length ? (
                <Table>
                  <Table.Tbody>
                    {data.requests.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          {LEAVE_TYPES[r.type as LeaveType]?.label ?? r.type}
                        </Table.Td>
                        <Table.Td>
                          {shortDate(r.fromDate)}
                          {r.toDate !== r.fromDate
                            ? ` – ${shortDate(r.toDate)}`
                            : ""}
                        </Table.Td>
                        <Table.Td ta="right">{r.days} d</Table.Td>
                        <Table.Td ta="right">
                          <StatusBadge status={r.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Empty>No leave taken yet.</Empty>
              )}
            </Section>

            <Section title="Upcoming holidays" flush>
              <Table>
                <Table.Tbody>
                  {data.holidays.map((h) => (
                    <Table.Tr key={h.date}>
                      <Table.Td>{h.name}</Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {weekday(h.date)}, {longDate(h.date)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Section>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
