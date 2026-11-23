"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Anchor,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import type { Metric } from "@/lib/config";
import { SetTargetModal, type PlanEmployee } from "./SetTargetModal";
import { api, notifyError, notifyOk } from "@/lib/client";
import { monthLabel } from "@/lib/dates";
import { num, pct, rupees, rupeesShort } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  AchievementBar,
  MonthSelect,
  PageHeader,
  StandingBadge,
  Stat,
} from "@/components/ui/primitives";
import type { BranchSummary, MetricCell, ScoreRow } from "@/services/targets";

function MetricValue({
  m,
  expected,
}: {
  m: MetricCell | undefined;
  expected?: number;
}) {
  if (!m) return <Text c="dimmed">—</Text>;
  const fmt = (v: number) => (m.unit === "inr" ? rupeesShort(v) : num(v));
  return (
    <Box>
      <Group gap={6} wrap="nowrap" justify="space-between">
        <Text size="sm" className="num">
          <b>{fmt(m.achieved)}</b>
          <Text span c="dimmed">
            {" "}
            / {fmt(m.target)}
          </Text>
        </Text>
        <Text size="xs" c="dimmed" className="num">
          {pct(m.pct)}
        </Text>
      </Group>
      <Box mt={5}>
        <AchievementBar value={m.pct} expected={expected} w="100%" />
      </Box>
    </Box>
  );
}

function EditModal({
  row,
  canEditTarget,
  month,
  onClose,
}: {
  row: ScoreRow;
  canEditTarget: boolean;
  month: string;
  onClose: (saved: boolean) => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      row.metrics.map((m) => [
        m.targetId,
        { target: m.target, achieved: m.achieved },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function remove() {
    setSaving(true);
    try {
      await api("/api/targets", "DELETE", {
        employeeId: row.employeeId,
        month,
      });
      notifyOk(`Removed ${row.name}'s targets for ${monthLabel(month)}.`);
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      for (const m of row.metrics) {
        const v = values[m.targetId];
        const body: { achieved?: number; target?: number } = {};
        if (v.achieved !== m.achieved) body.achieved = v.achieved;
        if (canEditTarget && v.target !== m.target) body.target = v.target;
        if (Object.keys(body).length)
          await api(`/api/targets/${m.targetId}`, "PATCH", body);
      }
      notifyOk(`Updated ${row.name}'s numbers.`);
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened
      onClose={() => onClose(false)}
      title={<Text fw={600}>Update achievement · {row.name}</Text>}
      size="md"
    >
      <Stack gap="md">
        {row.metrics.map((m) => {
          const v = values[m.targetId];
          const inr = m.unit === "inr";
          const livePct = v.target > 0 ? (v.achieved / v.target) * 100 : 0;
          return (
            <Box key={m.targetId}>
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={600}>
                  {m.label}
                </Text>
                <Text size="xs" c="dimmed" className="num">
                  {pct(livePct, 1)} of target · weight {m.weight}%
                </Text>
              </Group>
              <SimpleGrid cols={2} spacing="sm">
                <NumberInput
                  label="Target"
                  value={v.target}
                  disabled={!canEditTarget}
                  min={0}
                  prefix={inr ? "₹" : undefined}
                  thousandSeparator=","
                  thousandsGroupStyle={inr ? "lakh" : "thousand"}
                  hideControls
                  onChange={(n) =>
                    setValues((s) => ({
                      ...s,
                      [m.targetId]: { ...v, target: Number(n) || 0 },
                    }))
                  }
                />
                <NumberInput
                  label="Achieved"
                  value={v.achieved}
                  min={0}
                  prefix={inr ? "₹" : undefined}
                  thousandSeparator=","
                  thousandsGroupStyle={inr ? "lakh" : "thousand"}
                  hideControls
                  data-autofocus={m === row.metrics[0] ? true : undefined}
                  onChange={(n) =>
                    setValues((s) => ({
                      ...s,
                      [m.targetId]: { ...v, achieved: Number(n) || 0 },
                    }))
                  }
                />
              </SimpleGrid>
            </Box>
          );
        })}
        {!canEditTarget ? (
          <Text size="xs" c="dimmed">
            Targets are set by HR. You can update achieved numbers for your
            branch.
          </Text>
        ) : null}
        <Group justify="space-between" gap="xs">
          {canEditTarget ? (
            confirmRemove ? (
              <Group gap={6}>
                <Button size="xs" color="red" onClick={remove} loading={saving}>
                  Yes, remove targets
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setConfirmRemove(false)}
                >
                  Keep
                </Button>
              </Group>
            ) : (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => setConfirmRemove(true)}
              >
                Remove targets
              </Button>
            )
          ) : (
            <span />
          )}
          <Group gap="xs">
            <Button variant="default" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TargetsView({
  month,
  months,
  isOpen,
  progress,
  rows,
  branches,
  role,
  upcoming,
  planEmployees,
}: {
  month: string;
  months: string[];
  isOpen: boolean;
  progress: number;
  rows: ScoreRow[];
  branches: BranchSummary[];
  role: "HR" | "MANAGER" | "EMPLOYEE";
  /** Month has not started yet — targets can be planned, nothing achieved. */
  upcoming: boolean;
  planEmployees: PlanEmployee[];
}) {
  const router = useRouter();
  const [setting, setSetting] = useState(false);
  const [plan, setPlan] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [standingFilter, setStandingFilter] = useState("ALL");
  const [editing, setEditing] = useState<ScoreRow | null>(null);

  const expected = isOpen ? progress * 100 : undefined;
  const canEdit = role !== "EMPLOYEE";
  const branchNames = useMemo(
    () => [...new Set(rows.map((r) => r.branch))].sort(),
    [rows],
  );
  const filtered = rows.filter(
    (r) =>
      (plan === "ALL" || r.plan === plan) &&
      (branch === "ALL" || r.branch === branch) &&
      (standingFilter === "ALL" || r.standing === standingFilter),
  );

  const totals = rows.reduce(
    (t, r) => {
      for (const m of r.metrics) {
        if (m.metric === "DISBURSAL") {
          t.dT += m.target;
          t.dA += m.achieved;
        }
        if (m.metric === "COLLECTION") {
          t.cT += m.target;
          t.cA += m.achieved;
        }
      }
      return t;
    },
    { dT: 0, dA: 0, cT: 0, cA: 0 },
  );
  const count = (s: string) => rows.filter((r) => r.standing === s).length;
  const scoreLabel = isOpen ? "Projected" : "Final score";

  const columns: Column<ScoreRow>[] = [
    {
      key: "rank",
      header: "#",
      value: (r) => r.rank,
      width: 44,
      render: (r) => (
        <Text c="dimmed" size="sm">
          {r.rank}
        </Text>
      ),
    },
    {
      key: "name",
      header: "Employee",
      value: (r) => r.name,
      render: (r) => (
        <Box>
          <Anchor
            component={Link}
            href={`/employees/${r.employeeId}`}
            size="sm"
            fw={500}
            c="dark"
          >
            {r.name}
          </Anchor>
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {r.designation} · {r.code}
          </Text>
        </Box>
      ),
    },
    { key: "branch", header: "Branch", value: (r) => r.branch, width: 96 },
    {
      key: "primary",
      header: "Disbursal / Collection (₹)",
      value: (r) => r.metrics[0]?.pct,
      width: 210,
      render: (r) => <MetricValue m={r.metrics[0]} expected={expected} />,
    },
    {
      key: "secondary",
      header: "Files / Cases",
      value: (r) => r.metrics[1]?.pct,
      width: 170,
      render: (r) => <MetricValue m={r.metrics[1]} expected={expected} />,
    },
    ...(isOpen
      ? [
          {
            key: "score",
            header: "Done",
            align: "right" as const,
            value: (r: ScoreRow) => Number(r.score.toFixed(1)),
            render: (r: ScoreRow) => pct(r.score),
            width: 70,
          },
        ]
      : []),
    {
      key: "projected",
      header: scoreLabel,
      align: "right",
      width: 96,
      value: (r) => Number(r.projected.toFixed(1)),
      render: (r) => (
        <Text size="sm" fw={600} className="num">
          {pct(r.projected, 1)}
        </Text>
      ),
    },
    {
      key: "standing",
      header: "Standing",
      value: (r) => (upcoming ? "" : r.standing),
      width: 100,
      render: (r) =>
        upcoming ? (
          <Text size="xs" c="dimmed">
            Not started
          </Text>
        ) : (
          <StandingBadge standing={r.standing} closed={!isOpen} />
        ),
    },
    {
      key: "incentive",
      header: isOpen ? "Incentive (est.)" : "Incentive",
      align: "right",
      width: 110,
      value: (r) => r.incentive,
      render: (r) =>
        r.incentive ? rupees(r.incentive) : <Text c="dimmed">—</Text>,
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "",
            width: 84,
            noExport: true,
            render: (r: ScoreRow) => (
              <Button
                size="compact-xs"
                variant="default"
                onClick={() => setEditing(r)}
                aria-label={`Update ${r.name}`}
              >
                Update
              </Button>
            ),
          } satisfies Column<ScoreRow>,
        ]
      : []),
  ];

  const branchColumns: Column<BranchSummary>[] = [
    {
      key: "branch",
      header: "Branch",
      value: (b) => b.branch,
      render: (b) => (
        <Text size="sm" fw={500}>
          {b.branch}
        </Text>
      ),
    },
    {
      key: "people",
      header: "On plan",
      align: "right",
      value: (b) => b.people,
    },
    {
      key: "disb",
      header: "Disbursal",
      width: 230,
      value: (b) =>
        b.disbursalTarget ? (b.disbursalAchieved / b.disbursalTarget) * 100 : 0,
      render: (b) => (
        <MetricValue
          expected={expected}
          m={{
            targetId: 0,
            metric: "DISBURSAL",
            label: "",
            unit: "inr",
            target: b.disbursalTarget,
            achieved: b.disbursalAchieved,
            weight: 0,
            pct: b.disbursalTarget
              ? (b.disbursalAchieved / b.disbursalTarget) * 100
              : 0,
          }}
        />
      ),
    },
    {
      key: "coll",
      header: "Collection",
      width: 230,
      value: (b) =>
        b.collectionTarget
          ? (b.collectionAchieved / b.collectionTarget) * 100
          : 0,
      render: (b) => (
        <MetricValue
          expected={expected}
          m={{
            targetId: 0,
            metric: "COLLECTION",
            label: "",
            unit: "inr",
            target: b.collectionTarget,
            achieved: b.collectionAchieved,
            weight: 0,
            pct: b.collectionTarget
              ? (b.collectionAchieved / b.collectionTarget) * 100
              : 0,
          }}
        />
      ),
    },
    {
      key: "avg",
      header: `Avg ${scoreLabel.toLowerCase()}`,
      align: "right",
      value: (b) => Number(b.avgScore.toFixed(1)),
      render: (b) => (
        <Text size="sm" fw={600}>
          {pct(b.avgScore, 1)}
        </Text>
      ),
    },
    {
      key: "ontrack",
      header: isOpen ? "On track" : "Achieved",
      align: "right",
      value: (b) => b.onTrack,
      render: (b) => `${b.onTrack} of ${b.people}`,
    },
    {
      key: "inc",
      header: isOpen ? "Incentive (est.)" : "Incentive",
      align: "right",
      value: (b) => b.incentive,
      render: (b) => rupees(b.incentive),
    },
  ];

  return (
    <>
      <PageHeader
        title={role === "EMPLOYEE" ? "My targets" : "Targets & achievement"}
        subtitle={
          upcoming
            ? `${monthLabel(month)} · not started yet, set targets in advance`
            : isOpen
              ? `${monthLabel(month)} · month in progress, ${pct(progress * 100)} of working days done`
              : `${monthLabel(month)} · closed`
        }
        actions={
          <>
            <MonthSelect months={months} value={month} />
            {role === "HR" ? (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setSetting(true)}
              >
                Set targets
              </Button>
            ) : null}
          </>
        }
      />

      {role === "EMPLOYEE" ? (
        rows[0] ? (
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="md">
            {rows[0].metrics.map((m) => (
              <Stat
                key={m.metric}
                label={m.label}
                value={pct(m.pct)}
                hint={`${m.unit === "inr" ? rupeesShort(m.achieved) : num(m.achieved)} of ${m.unit === "inr" ? rupeesShort(m.target) : num(m.target)}`}
              />
            ))}
            <Stat
              label={isOpen ? "Score so far" : "Final score"}
              value={pct(rows[0].score, 1)}
              hint={
                isOpen
                  ? `${pct(progress * 100)} expected by today`
                  : "Weighted achievement"
              }
            />
            {isOpen ? (
              <Stat
                label="Projected month end"
                value={pct(rows[0].projected, 1)}
                tone={
                  rows[0].standing === "ON_TRACK"
                    ? "good"
                    : rows[0].standing === "AT_RISK"
                      ? "warn"
                      : "bad"
                }
                hint="At the current pace"
              />
            ) : null}
            <Stat
              label={isOpen ? "Incentive (est.)" : "Incentive"}
              value={rupees(rows[0].incentive)}
              tone={rows[0].incentive ? "good" : "default"}
              hint={`Rank ${rows[0].rank} this month`}
            />
          </SimpleGrid>
        ) : null
      ) : (
        <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="md">
          <Stat
            label="Disbursal"
            value={pct(totals.dT ? (totals.dA / totals.dT) * 100 : 0)}
            hint={`${rupeesShort(totals.dA)} of ${rupeesShort(totals.dT)}`}
          />
          <Stat
            label="Collection"
            value={pct(totals.cT ? (totals.cA / totals.cT) * 100 : 0)}
            hint={`${rupeesShort(totals.cA)} of ${rupeesShort(totals.cT)}`}
          />
          {upcoming ? (
            <>
              <Stat
                label="Targets set"
                value={`${rows.length} of ${planEmployees.length || rows.length}`}
                hint="People on an incentive plan"
              />
              <Stat
                label="Still to set"
                value={Math.max(0, planEmployees.length - rows.length)}
                tone={planEmployees.length > rows.length ? "warn" : "default"}
                hint="No targets yet"
              />
              <Stat
                label="Month status"
                value="Not started"
                hint="Achievement opens on the 1st"
              />
            </>
          ) : (
            <>
              <Stat
                label={isOpen ? "On track" : "Achieved"}
                value={count("ON_TRACK")}
                tone="good"
                hint={`of ${rows.length} on a plan`}
              />
              <Stat
                label={isOpen ? "At risk" : "Near miss"}
                value={count("AT_RISK")}
                tone="warn"
                hint="85–100% score"
              />
              <Stat
                label={isOpen ? "Behind" : "Missed"}
                value={count("BEHIND")}
                tone="bad"
                hint="Below 85% score"
              />
            </>
          )}
        </SimpleGrid>
      )}

      <Tabs defaultValue="scorecard" keepMounted={false}>
        {role === "HR" ? (
          <Tabs.List mb="md">
            <Tabs.Tab value="scorecard">Scorecard</Tabs.Tab>
            <Tabs.Tab value="branches">Branch leaderboard</Tabs.Tab>
          </Tabs.List>
        ) : null}

        <Tabs.Panel value="scorecard">
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.employeeId}
            searchPlaceholder={
              role === "EMPLOYEE" ? undefined : "Search employee"
            }
            csvName={`targets-${month}`}
            maxHeight={620}
            empty={
              rows.length
                ? "No targets match these filters."
                : role === "HR"
                  ? "No targets set for this month yet. Use Set targets to add them."
                  : "No targets set for this month yet."
            }
            filters={
              role === "EMPLOYEE" ? undefined : (
                <>
                  <SegmentedControl
                    size="xs"
                    value={plan}
                    onChange={setPlan}
                    data={[
                      { value: "ALL", label: "All" },
                      { value: "SALES", label: "Sales" },
                      { value: "COLLECTION", label: "Collection" },
                    ]}
                  />
                  {role === "HR" ? (
                    <Select
                      w={150}
                      aria-label="Branch"
                      value={branch}
                      onChange={(v) => setBranch(v ?? "ALL")}
                      data={[
                        { value: "ALL", label: "All branches" },
                        ...branchNames.map((b) => ({ value: b, label: b })),
                      ]}
                    />
                  ) : null}
                  <Select
                    w={140}
                    aria-label="Standing"
                    value={standingFilter}
                    onChange={(v) => setStandingFilter(v ?? "ALL")}
                    data={[
                      { value: "ALL", label: "Any standing" },
                      {
                        value: "ON_TRACK",
                        label: isOpen ? "On track" : "Achieved",
                      },
                      {
                        value: "AT_RISK",
                        label: isOpen ? "At risk" : "Near miss",
                      },
                      { value: "BEHIND", label: isOpen ? "Behind" : "Missed" },
                    ]}
                  />
                </>
              )
            }
            footer={
              <Text size="xs" c="dimmed">
                Score = weighted achievement (₹ metric 70%, count metric 30%),
                each capped at 150%.
                {isOpen
                  ? " Projected = score at the current pace by month end; the dark marker on each bar is where the month should be today."
                  : ""}
              </Text>
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="branches">
          <DataTable
            rows={branches}
            columns={branchColumns}
            rowKey={(b) => b.branchId}
            csvName={`branch-leaderboard-${month}`}
            initialSort={{ key: "avg", dir: "desc" }}
          />
        </Tabs.Panel>
      </Tabs>

      {setting ? (
        <SetTargetModal
          month={month}
          employees={planEmployees}
          existing={Object.fromEntries(
            rows.map((r) => [
              r.employeeId,
              Object.fromEntries(
                r.metrics.map((m) => [m.metric, m.target]),
              ) as Partial<Record<Metric, number>>,
            ]),
          )}
          onClose={(saved) => {
            setSetting(false);
            if (saved) router.refresh();
          }}
        />
      ) : null}
      {editing ? (
        <EditModal
          row={editing}
          canEditTarget={role === "HR"}
          month={month}
          onClose={(saved) => {
            setEditing(null);
            if (saved) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
