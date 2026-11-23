"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionIcon, Anchor, Badge, Box, Button, Grid, Group, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Table, Tabs, Text, Title } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { PLANS, type Plan } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { monthLabel } from "@/lib/dates";
import { pct, rupees } from "@/lib/format";
import { slabFor, type Slab } from "@/lib/scoring";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MonthSelect, PageHeader, Stat } from "@/components/ui/primitives";
import type { ScoreRow } from "@/services/targets";

function slabLabel(s: Slab | null) {
  if (!s) return "—";
  if (s.maxPct === null) return `${s.minPct}% and above`;
  if (s.minPct === 0) return `Below ${s.maxPct}%`;
  return `${s.minPct}% – ${s.maxPct}%`;
}

type DraftSlab = { minPct: number | string; maxPct: number | string; amount: number | string };

function SlabEditor({ plan, slabs, editable }: { plan: Plan; slabs: Slab[]; editable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftSlab[]>(() =>
    slabs.map((s) => ({ minPct: s.minPct, maxPct: s.maxPct ?? "", amount: s.amount })),
  );
  const [saving, setSaving] = useState(false);
  const [trial, setTrial] = useState<number | string>(112);

  const parsed: Slab[] = draft.map((d) => ({
    minPct: Number(d.minPct) || 0,
    maxPct: d.maxPct === "" ? null : Number(d.maxPct),
    amount: Number(d.amount) || 0,
  }));
  const trialSlab = slabFor(Number(trial) || 0, parsed);
  const dirty = JSON.stringify(parsed) !== JSON.stringify(slabs.map((s) => ({ minPct: s.minPct, maxPct: s.maxPct, amount: s.amount })));

  const set = (i: number, patch: Partial<DraftSlab>) => setDraft((d) => d.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  async function save() {
    setSaving(true);
    try {
      await api("/api/incentives/slabs", "PUT", { plan, slabs: parsed });
      notifyOk(`${PLANS[plan].label} saved. Payouts are recalculated.`);
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper withBorder>
      <Group justify="space-between" px="md" py={10} style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Box>
          <Title order={3}>{PLANS[plan].label}</Title>
          <Text size="xs" c="dimmed">
            {plan === "SALES" ? "Relationship Officers · disbursal 70%, files 30%" : "Collection Officers · collection 70%, cases resolved 30%"}
          </Text>
        </Box>
        {editable ? (
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        ) : null}
      </Group>

      <Table>
        <Table.Thead bg="gray.0">
          <Table.Tr>
            <Table.Th>Score from</Table.Th>
            <Table.Th>Up to (below)</Table.Th>
            <Table.Th>Monthly payout</Table.Th>
            {editable ? <Table.Th w={40} /> : null}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {draft.map((row, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                {editable ? (
                  <NumberInput w={110} aria-label="Score from" value={row.minPct} suffix="%" min={0} hideControls onChange={(v) => set(i, { minPct: v })} />
                ) : (
                  `${row.minPct}%`
                )}
              </Table.Td>
              <Table.Td>
                {editable ? (
                  <NumberInput w={110} aria-label="Up to" value={row.maxPct} suffix="%" min={0} hideControls placeholder="No limit" onChange={(v) => set(i, { maxPct: v })} />
                ) : row.maxPct === "" ? (
                  "No limit"
                ) : (
                  `${row.maxPct}%`
                )}
              </Table.Td>
              <Table.Td>
                {editable ? (
                  <NumberInput w={140} aria-label="Payout" value={row.amount} prefix="₹" min={0} thousandSeparator="," thousandsGroupStyle="lakh" hideControls onChange={(v) => set(i, { amount: v })} />
                ) : (
                  rupees(Number(row.amount))
                )}
              </Table.Td>
              {editable ? (
                <Table.Td>
                  <ActionIcon variant="subtle" color="gray" aria-label="Remove slab" disabled={draft.length <= 1} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                    <IconTrash size={15} />
                  </ActionIcon>
                </Table.Td>
              ) : null}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" px="md" py={10} style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
        {editable ? (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              setDraft((d) => {
                const last = d[d.length - 1];
                const from = last.maxPct === "" ? Number(last.minPct) + 10 : Number(last.maxPct);
                const closed = d.map((r, j) => (j === d.length - 1 && r.maxPct === "" ? { ...r, maxPct: from } : r));
                return [...closed, { minPct: from, maxPct: "", amount: last.amount }];
              })
            }
          >
            Add slab
          </Button>
        ) : (
          <span />
        )}
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Try a score
          </Text>
          <NumberInput w={90} size="xs" aria-label="Try a score" value={trial} suffix="%" min={0} hideControls onChange={setTrial} />
          <Text size="sm" className="num">
            pays <b>{rupees(trialSlab?.amount ?? 0)}</b>
          </Text>
        </Group>
      </Group>
    </Paper>
  );
}

export function IncentivesView({
  month,
  months,
  isOpen,
  rows,
  slabs,
  role,
}: {
  month: string;
  months: string[];
  isOpen: boolean;
  rows: ScoreRow[];
  slabs: Record<Plan, Slab[]>;
  role: "HR" | "MANAGER" | "EMPLOYEE";
}) {
  const [plan, setPlan] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const branchNames = useMemo(() => [...new Set(rows.map((r) => r.branch))].sort(), [rows]);
  const filtered = rows.filter((r) => (plan === "ALL" || r.plan === plan) && (branch === "ALL" || r.branch === branch));

  const total = rows.reduce((s, r) => s + r.incentive, 0);
  const earners = rows.filter((r) => r.incentive > 0);
  const top = earners.reduce((m, r) => Math.max(m, r.incentive), 0);

  const columns: Column<ScoreRow>[] = [
    {
      key: "name",
      header: "Employee",
      value: (r) => r.name,
      render: (r) => (
        <Box>
          <Anchor component={Link} href={`/employees/${r.employeeId}`} size="sm" fw={500} c="dark">
            {r.name}
          </Anchor>
          <Text size="xs" c="dimmed">
            {r.code}
          </Text>
        </Box>
      ),
    },
    { key: "branch", header: "Branch", value: (r) => r.branch },
    { key: "plan", header: "Plan", value: (r) => (r.plan === "SALES" ? "Sales" : "Collection") },
    ...scoreColumns(isOpen),
    { key: "slab", header: "Slab", value: (r) => slabLabel(r.slab) },
    {
      key: "incentive",
      header: isOpen ? "Estimated payout" : "Payout",
      align: "right",
      value: (r) => r.incentive,
      render: (r) =>
        r.incentive ? (
          <Text size="sm" fw={600} className="num">
            {rupees(r.incentive)}
          </Text>
        ) : (
          <Text c="dimmed">—</Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={role === "EMPLOYEE" ? "My incentive" : "Incentives"}
        subtitle={
          <>
            {monthLabel(month)} ·{" "}
            {isOpen ? "estimate at the current pace, final numbers lock when the month closes" : "final, based on closed-month achievement"}
          </>
        }
        actions={<MonthSelect months={months} value={month} />}
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
        <Stat label={isOpen ? "Estimated payout" : "Total payout"} value={rupees(total)} hint={role === "EMPLOYEE" ? monthLabel(month) : `${rows.length} employees on a plan`} />
        {role === "EMPLOYEE" ? (
          <>
            <Stat label={isOpen ? "Projected score" : "Final score"} value={rows[0] ? pct(rows[0].projected, 1) : "—"} />
            <Stat label="Slab" value={rows[0] ? slabLabel(rows[0].slab) : "—"} />
            <Stat label="Plan" value={rows[0] ? (rows[0].plan === "SALES" ? "Sales" : "Collection") : "—"} />
          </>
        ) : (
          <>
            <Stat label="Earning an incentive" value={`${earners.length} of ${rows.length}`} hint="Score of 90% or more" />
            <Stat label="Average per earner" value={earners.length ? rupees(total / earners.length) : "—"} />
            <Stat label="Highest payout" value={top ? rupees(top) : "—"} />
          </>
        )}
      </SimpleGrid>

      <Tabs defaultValue="payouts" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="payouts">{role === "EMPLOYEE" ? "My payout" : "Payouts"}</Tabs.Tab>
          <Tabs.Tab value="slabs">
            Slabs {role === "HR" ? null : <Badge ml={6} color="gray" size="xs">View only</Badge>}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="payouts">
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.employeeId}
            searchPlaceholder={role === "EMPLOYEE" ? undefined : "Search employee"}
            csvName={`incentive-payout-${month}`}
            initialSort={{ key: "incentive", dir: "desc" }}
            maxHeight={620}
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
                      data={[{ value: "ALL", label: "All branches" }, ...branchNames.map((b) => ({ value: b, label: b }))]}
                    />
                  ) : null}
                </>
              )
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="slabs">
          <Grid gutter="md">
            {(Object.keys(PLANS) as Plan[]).map((p) => (
              <Grid.Col key={p} span={{ base: 12, lg: 6 }}>
                <SlabEditor plan={p} slabs={slabs[p]} editable={role === "HR"} />
              </Grid.Col>
            ))}
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function scoreColumns(isOpen: boolean): Column<ScoreRow>[] {
  return [
    ...(isOpen
      ? [
          {
            key: "score",
            header: "Done so far",
            align: "right" as const,
            value: (r: ScoreRow) => Number(r.score.toFixed(1)),
            render: (r: ScoreRow) => pct(r.score, 1),
          },
        ]
      : []),
    {
      key: "projected",
      header: isOpen ? "Projected score" : "Final score",
      align: "right" as const,
      value: (r: ScoreRow) => Number(r.projected.toFixed(1)),
      render: (r: ScoreRow) => pct(r.projected, 1),
    },
  ];
}
