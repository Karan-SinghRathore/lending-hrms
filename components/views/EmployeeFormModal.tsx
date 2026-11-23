"use client";

import { useState } from "react";
import { Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { DESIGNATIONS } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { todayStr } from "@/lib/dates";

export type EmployeeFormValues = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  gender: string;
  designation: string;
  branchId: number | null;
  joinDate: string | null;
  monthlyCtc: number | string;
  status: string;
};

const PLAN_NOTE: Record<string, string> = {
  SALES: "Goes on the sales incentive plan (disbursal + files).",
  COLLECTION: "Goes on the collection incentive plan (collection + cases).",
  NONE: "No incentive plan for this role.",
};

export function EmployeeFormModal({
  initial,
  branches,
  onClose,
}: {
  initial?: EmployeeFormValues;
  branches: { id: number; name: string }[];
  onClose: (saved: boolean, id?: number) => void;
}) {
  const editing = !!initial?.id;
  const [f, setF] = useState<EmployeeFormValues>(
    initial ?? { name: "", email: "", phone: "", gender: "M", designation: "", branchId: null, joinDate: todayStr(), monthlyCtc: "", status: "ACTIVE" },
  );
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EmployeeFormValues>) => setF((s) => ({ ...s, ...patch }));
  const preset = DESIGNATIONS[f.designation];
  // Designations outside the preset list (e.g. HR Manager) stay selectable when editing.
  const designationOptions = [...new Set([...Object.keys(DESIGNATIONS), ...(f.designation ? [f.designation] : [])])];
  const ready = f.name.trim() && f.email.trim() && f.phone.trim() && preset && f.branchId && f.joinDate && Number(f.monthlyCtc) > 0;

  async function save() {
    setSaving(true);
    try {
      const body = { ...f, monthlyCtc: Number(f.monthlyCtc) };
      const res = editing
        ? await api<{ id: number }>(`/api/employees/${f.id}`, "PATCH", body)
        : await api<{ id: number; code: string }>("/api/employees", "POST", body);
      notifyOk(editing ? `${f.name}'s details updated.` : `${f.name} added. Joining checklist started.`);
      onClose(true, res.id);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened onClose={() => onClose(false)} title={<Text fw={600}>{editing ? `Edit employee · ${initial!.name}` : "Add employee"}</Text>} size="lg">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="md">
          <TextInput label="Full name" value={f.name} onChange={(e) => set({ name: e.currentTarget.value })} data-autofocus />
          <Select
            label="Gender"
            value={f.gender}
            onChange={(v) => set({ gender: v ?? "M" })}
            data={[
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
            ]}
          />
          <TextInput label="Work email" placeholder="name@company.in" value={f.email} onChange={(e) => set({ email: e.currentTarget.value })} />
          <TextInput label="Mobile number" placeholder="10 digits" value={f.phone} maxLength={10} onChange={(e) => set({ phone: e.currentTarget.value.replace(/\D/g, "") })} />
          <Select
            label="Designation"
            placeholder="Choose"
            value={f.designation || null}
            onChange={(v) => set({ designation: v ?? "" })}
            data={designationOptions}
            error={f.designation && !preset ? "Pick one of the standard designations to save" : undefined}
          />
          <Select
            label="Branch"
            placeholder="Choose"
            value={f.branchId ? String(f.branchId) : null}
            onChange={(v) => set({ branchId: v ? Number(v) : null })}
            data={branches.map((b) => ({ value: String(b.id), label: b.name }))}
          />
          <DatePickerInput label="Date of joining" value={f.joinDate} onChange={(v) => set({ joinDate: v })} valueFormat="DD MMM YYYY" weekendDays={[0]} />
          <NumberInput
            label="Monthly CTC"
            value={f.monthlyCtc}
            onChange={(v) => set({ monthlyCtc: v })}
            prefix="₹"
            min={0}
            thousandSeparator=","
            thousandsGroupStyle="lakh"
            hideControls
          />
          {editing ? (
            <Select
              label="Status"
              value={f.status}
              onChange={(v) => set({ status: v ?? "ACTIVE" })}
              data={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive (left the company)" },
              ]}
            />
          ) : null}
        </SimpleGrid>
        {preset ? (
          <Text size="xs" c="dimmed">
            Department: {preset.department}. {PLAN_NOTE[preset.plan]} Reporting manager is set to the branch manager.
            {editing ? "" : " Employee code and leave balance are created automatically."}
          </Text>
        ) : null}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!ready}>
            {editing ? "Save changes" : "Add employee"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
