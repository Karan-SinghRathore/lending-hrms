"use client";

import { useState } from "react";
import { Button, Group, Modal, NumberInput, Select, Stack, Text } from "@mantine/core";
import { METRICS, PLANS, type Metric, type Plan } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { monthLabel } from "@/lib/dates";

export type PlanEmployee = { id: string; name: string; code: string; branch: string; plan: Plan; hasTargets: boolean };

export function SetTargetModal({
  month,
  employees,
  existing,
  onClose,
}: {
  month: string;
  employees: PlanEmployee[];
  /** Current targets by employee id, used to prefill when replacing. */
  existing: Record<string, Partial<Record<Metric, number>>>;
  onClose: (saved: boolean) => void;
}) {
  const firstMissing = employees.find((e) => !e.hasTargets);
  const [employeeId, setEmployeeId] = useState<string | null>(firstMissing ? String(firstMissing.id) : null);
  const [values, setValues] = useState<Partial<Record<Metric, number | string>>>({});
  const [saving, setSaving] = useState(false);

  const emp = employees.find((e) => String(e.id) === employeeId);
  const metrics = emp ? PLANS[emp.plan].metrics : [];
  const current = emp ? (existing[emp.id] ?? {}) : {};
  const valueOf = (m: Metric) => values[m] ?? current[m] ?? "";
  const ready = !!emp && metrics.every((m) => Number(valueOf(m)) > 0);

  async function save() {
    if (!emp) return;
    setSaving(true);
    try {
      await api("/api/targets", "POST", {
        employeeId: emp.id,
        month,
        values: Object.fromEntries(metrics.map((m) => [m, Number(valueOf(m))])),
      });
      notifyOk(`Targets for ${emp.name} saved for ${monthLabel(month)}.`);
      onClose(true);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened onClose={() => onClose(false)} title={<Text fw={600}>Set targets · {monthLabel(month)}</Text>} size="md">
      <Stack gap="md">
        <Select
          label="Employee"
          placeholder="Search by name"
          searchable
          data-autofocus
          value={employeeId}
          onChange={(v) => {
            setEmployeeId(v);
            setValues({});
          }}
          data={[
            { group: "No targets yet", items: employees.filter((e) => !e.hasTargets).map((e) => ({ value: String(e.id), label: `${e.name} · ${e.branch}` })) },
            { group: "Already set (will be replaced)", items: employees.filter((e) => e.hasTargets).map((e) => ({ value: String(e.id), label: `${e.name} · ${e.branch}` })) },
          ].filter((g) => g.items.length)}
          nothingFoundMessage="No one on an incentive plan matches"
        />
        {emp ? (
          <>
            <Text size="xs" c="dimmed">
              {PLANS[emp.plan].label} · {emp.code}
              {emp.hasTargets ? " · existing targets shown, achieved numbers are kept" : ""}
            </Text>
            <Group grow align="flex-start">
              {metrics.map((m) => {
                const inr = METRICS[m].unit === "inr";
                return (
                  <NumberInput
                    key={m}
                    label={`${METRICS[m].label} target`}
                    placeholder={inr ? "₹" : "Count"}
                    value={valueOf(m)}
                    min={0}
                    prefix={inr ? "₹" : undefined}
                    thousandSeparator=","
                    thousandsGroupStyle={inr ? "lakh" : "thousand"}
                    hideControls
                    onChange={(v) => setValues((s) => ({ ...s, [m]: v }))}
                  />
                );
              })}
            </Group>
          </>
        ) : null}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!ready}>
            Save targets
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
