"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Box, Button, Divider, Group, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconCalculator, IconSend } from "@tabler/icons-react";
import { COMPANY_NAME, PAYROLL } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { monthLabel } from "@/lib/dates";
import { rupees } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { KeyValue, MonthSelect, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";

export type SlipRow = {
  id: number;
  month: string;
  name: string;
  code: string;
  designation: string;
  branch: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  basic: number;
  hra: number;
  allowance: number;
  incentive: number;
  lopAmount: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  net: number;
  status: string;
};

const deductions = (s: SlipRow) => s.pf + s.esi + s.pt + s.tds;

function PayslipModal({ slip, onClose }: { slip: SlipRow; onClose: () => void }) {
  return (
    <Modal opened onClose={onClose} size="lg" title={<Text fw={600}>Payslip · {monthLabel(slip.month)}</Text>}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text fw={600}>{slip.name}</Text>
            <Text size="xs" c="dimmed">
              {slip.designation} · {slip.branch} branch · {slip.code}
            </Text>
          </Box>
          <Box ta="right">
            <Text size="xs" c="dimmed">
              {COMPANY_NAME}
            </Text>
            <StatusBadge status={slip.status} />
          </Box>
        </Group>
        <Text size="xs" c="dimmed">
          Paid days {slip.paidDays} of {slip.workingDays} working days
          {slip.lopDays ? ` · ${slip.lopDays} day(s) loss of pay` : ""}
        </Text>
        <SimpleGrid cols={2} spacing="lg">
          <Box>
            <Text size="xs" fw={600} c="gray.7" mb={8}>
              Earnings
            </Text>
            <KeyValue
              items={[
                { label: "Basic", value: rupees(slip.basic) },
                { label: "HRA", value: rupees(slip.hra) },
                { label: "Special allowance", value: rupees(slip.allowance) },
                { label: "Incentive", value: slip.incentive ? rupees(slip.incentive) : "—" },
                ...(slip.lopAmount ? [{ label: "Loss of pay", value: `− ${rupees(slip.lopAmount)}` }] : []),
              ]}
            />
            <Divider my={10} />
            <KeyValue items={[{ label: "Gross earnings", value: <b>{rupees(slip.gross)}</b> }]} />
          </Box>
          <Box>
            <Text size="xs" fw={600} c="gray.7" mb={8}>
              Deductions
            </Text>
            <KeyValue
              items={[
                { label: "Provident fund", value: rupees(slip.pf) },
                { label: "ESI", value: slip.esi ? rupees(slip.esi) : "—" },
                { label: "Professional tax", value: rupees(slip.pt) },
                { label: "TDS", value: slip.tds ? rupees(slip.tds) : "—" },
              ]}
            />
            <Divider my={10} />
            <KeyValue items={[{ label: "Total deductions", value: <b>{rupees(deductions(slip))}</b> }]} />
          </Box>
        </SimpleGrid>
        <Group justify="space-between" p="sm" bg="gray.0" style={{ borderRadius: 6 }}>
          <Text fw={600}>Net pay</Text>
          <Text fw={700} fz={20} className="num">
            {rupees(slip.net)}
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
}

export function PayrollView({
  role,
  month,
  months,
  slips,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  month: string;
  months: string[];
  slips: SlipRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"RUN" | "PAY" | null>(null);
  const [open, setOpen] = useState<SlipRow | null>(null);
  const [confirmPay, setConfirmPay] = useState(false);

  const isHr = role === "HR";
  const paid = slips.length > 0 && slips.every((s) => s.status === "PAID");
  const sum = (f: (s: SlipRow) => number) => slips.reduce((t, s) => t + f(s), 0);

  async function act(action: "RUN" | "PAY") {
    setBusy(action);
    try {
      const res = await api<{ count: number; attendanceUsed?: boolean }>("/api/payroll", "POST", { action, month });
      notifyOk(
        action === "RUN"
          ? `Payroll calculated for ${res.count} employees${res.attendanceUsed === false ? " (no attendance on record for this month, so no loss of pay)" : ""}.`
          : `Payment released for ${res.count} employees. Payslips are now visible to them.`,
      );
      setConfirmPay(false);
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  const hrColumns: Column<SlipRow>[] = [
    {
      key: "name",
      header: "Employee",
      value: (s) => s.name,
      render: (s) => (
        <Box>
          <Text size="sm" fw={500}>
            {s.name}
          </Text>
          <Text size="xs" c="dimmed">
            {s.designation} · {s.code}
          </Text>
        </Box>
      ),
    },
    { key: "branch", header: "Branch", value: (s) => s.branch },
    { key: "days", header: "Paid days", align: "right", value: (s) => s.paidDays, render: (s) => `${s.paidDays} / ${s.workingDays}` },
    { key: "lop", header: "LOP", align: "right", value: (s) => s.lopDays, render: (s) => (s.lopDays ? <Text size="sm" c="red.8">{s.lopDays}</Text> : "—") },
    { key: "fixed", header: "Fixed pay", align: "right", value: (s) => s.basic + s.hra + s.allowance, render: (s) => rupees(s.basic + s.hra + s.allowance) },
    { key: "incentive", header: "Incentive", align: "right", value: (s) => s.incentive, render: (s) => (s.incentive ? rupees(s.incentive) : "—") },
    { key: "gross", header: "Gross", align: "right", value: (s) => s.gross, render: (s) => rupees(s.gross) },
    { key: "ded", header: "Deductions", align: "right", value: (s) => deductions(s), render: (s) => rupees(deductions(s)) },
    { key: "net", header: "Net pay", align: "right", value: (s) => s.net, render: (s) => <Text size="sm" fw={600} className="num">{rupees(s.net)}</Text> },
    { key: "status", header: "Status", value: (s) => s.status, render: (s) => <StatusBadge status={s.status} /> },
  ];

  const myColumns: Column<SlipRow>[] = [
    { key: "month", header: "Month", value: (s) => s.month, render: (s) => monthLabel(s.month) },
    { key: "days", header: "Paid days", align: "right", value: (s) => s.paidDays, render: (s) => `${s.paidDays} / ${s.workingDays}` },
    { key: "gross", header: "Gross", align: "right", value: (s) => s.gross, render: (s) => rupees(s.gross) },
    { key: "incentive", header: "Incentive", align: "right", value: (s) => s.incentive, render: (s) => (s.incentive ? rupees(s.incentive) : "—") },
    { key: "ded", header: "Deductions", align: "right", value: (s) => deductions(s), render: (s) => rupees(deductions(s)) },
    { key: "net", header: "Net pay", align: "right", value: (s) => s.net, render: (s) => <Text size="sm" fw={600} className="num">{rupees(s.net)}</Text> },
  ];

  if (!isHr) {
    return (
      <>
        <PageHeader title="My payslips" subtitle="Payslips appear here once HR releases the month's payment" />
        <DataTable rows={slips} columns={myColumns} rowKey={(s) => s.id} onRowClick={setOpen} empty="No payslips released yet." />
        {open ? <PayslipModal slip={open} onClose={() => setOpen(null)} /> : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle={`${monthLabel(month)} · ${slips.length === 0 ? "not calculated yet" : paid ? "paid and locked" : "draft, review and release"}`}
        actions={
          <>
            <MonthSelect months={months} value={month} />
            {!paid ? (
              <Button variant={slips.length ? "default" : "filled"} leftSection={<IconCalculator size={16} />} loading={busy === "RUN"} onClick={() => act("RUN")}>
                {slips.length ? "Recalculate" : "Run payroll"}
              </Button>
            ) : null}
            {slips.length && !paid ? (
              <Button leftSection={<IconSend size={16} />} onClick={() => setConfirmPay(true)}>
                Release payment
              </Button>
            ) : null}
          </>
        }
      />

      <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md" mb="md">
        <Stat label="Employees" value={slips.length || "—"} hint={slips.length ? `${slips.filter((s) => s.lopDays > 0).length} with loss of pay` : "Run payroll to calculate"} />
        <Stat label="Fixed pay" value={slips.length ? rupees(sum((s) => s.basic + s.hra + s.allowance - s.lopAmount)) : "—"} hint="After loss of pay" />
        <Stat label="Incentives" value={slips.length ? rupees(sum((s) => s.incentive)) : "—"} hint="From the incentive payout sheet" />
        <Stat label="Deductions" value={slips.length ? rupees(sum(deductions)) : "—"} hint="PF, ESI, PT, TDS" />
        <Stat label="Net payable" value={slips.length ? rupees(sum((s) => s.net)) : "—"} tone={paid ? "good" : "default"} hint={paid ? "Released" : "To be released"} />
      </SimpleGrid>

      <DataTable
        rows={slips}
        columns={hrColumns}
        rowKey={(s) => s.id}
        searchPlaceholder="Search employee"
        csvName={`payroll-${month}`}
        maxHeight={600}
        onRowClick={setOpen}
        empty={`Payroll for ${monthLabel(month)} has not been calculated. Use Run payroll: it takes fixed pay from each employee's CTC, loss of pay from the attendance register and incentives from the payout sheet.`}
        footer={
          <Text size="xs" c="dimmed">
            Prototype assumptions: basic {PAYROLL.basicPct}% of CTC, HRA {PAYROLL.hraPctOfBasic}% of basic, PF {PAYROLL.pfPct}% on basic up to {rupees(PAYROLL.pfWageCap)}, ESI {PAYROLL.esiPct}% up to {rupees(PAYROLL.esiGrossLimit)} gross, PT {rupees(PAYROLL.professionalTax)}, TDS estimated. Statutory rules are to be confirmed with the company&apos;s accountant before real use.
          </Text>
        }
      />

      {open ? <PayslipModal slip={open} onClose={() => setOpen(null)} /> : null}
      <Modal opened={confirmPay} onClose={() => setConfirmPay(false)} title={<Text fw={600}>Release payment · {monthLabel(month)}</Text>} size="sm">
        <Stack gap="md">
          <Text size="sm">
            {slips.length} payslips, net {rupees(sum((s) => s.net))}. After release the month is locked and employees can see their payslips.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmPay(false)}>
              Cancel
            </Button>
            <Button onClick={() => act("PAY")} loading={busy === "PAY"}>
              Release payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
