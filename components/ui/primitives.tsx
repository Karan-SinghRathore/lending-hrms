"use client";

import { usePathname, useRouter } from "next/navigation";
import { Badge, Box, Group, Paper, Progress, Select, Stack, Text, Title, Tooltip } from "@mantine/core";
import { monthLabel } from "@/lib/dates";
import { pct } from "@/lib/format";
import type { Standing } from "@/lib/scoring";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" wrap="nowrap">
      <Box>
        <Title order={1}>{title}</Title>
        {subtitle ? (
          <Text size="sm" c="dimmed" mt={2}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {actions ? (
        <Group gap="xs" wrap="nowrap">
          {actions}
        </Group>
      ) : null}
    </Group>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  /** Small muted icon in the top-right corner. */
  icon?: React.ReactNode;
  /** Thin bar under the value; `expected` draws a marker for where it should be today. */
  progress?: { value: number; expected?: number };
}) {
  const color = tone === "good" ? "teal.8" : tone === "warn" ? "yellow.9" : tone === "bad" ? "red.8" : undefined;
  const bar = tone === "good" ? "teal" : tone === "warn" ? "yellow" : tone === "bad" ? "red" : "brand";
  return (
    <Paper withBorder p="md" h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed" fw={500}>
          {label}
        </Text>
        {icon ? (
          <Box c="gray.5" style={{ lineHeight: 0, flexShrink: 0 }}>
            {icon}
          </Box>
        ) : null}
      </Group>
      <Text className="num" fz={24} fw={600} mt={4} lh={1.2} c={color}>
        {value}
      </Text>
      {progress ? (
        <Box pos="relative" mt={8} mb={2}>
          <Progress value={Math.min(progress.value, 100)} color={bar} size={5} radius="xs" />
          {progress.expected !== undefined && progress.expected < 100 ? (
            <Box pos="absolute" top={-3} left={`${progress.expected}%`} w={2} h={11} bg="gray.7" style={{ borderRadius: 1 }} aria-hidden />
          ) : null}
        </Box>
      ) : null}
      {hint ? (
        <Text size="xs" c="dimmed" mt={4}>
          {hint}
        </Text>
      ) : null}
    </Paper>
  );
}

/** Small heading above a group of tiles. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="11px" fw={600} c="gray.6" tt="uppercase" mb={6} style={{ letterSpacing: 0.4 }}>
      {children}
    </Text>
  );
}

export function Section({
  title,
  right,
  children,
  flush,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** No inner padding — for tables that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <Paper withBorder>
      <Group justify="space-between" px="md" py={10} style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Title order={3}>{title}</Title>
        {right}
      </Group>
      <Box p={flush ? 0 : "md"}>{children}</Box>
    </Paper>
  );
}

const STANDING: Record<Standing, { label: string; color: string }> = {
  ON_TRACK: { label: "On track", color: "teal" },
  AT_RISK: { label: "At risk", color: "yellow" },
  BEHIND: { label: "Behind", color: "red" },
};

export function StandingBadge({ standing, closed }: { standing: Standing; closed?: boolean }) {
  const s = STANDING[standing];
  const label = closed ? (standing === "ON_TRACK" ? "Achieved" : standing === "AT_RISK" ? "Near miss" : "Missed") : s.label;
  return <Badge color={s.color}>{label}</Badge>;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "yellow",
  APPROVED: "teal",
  REJECTED: "red",
  CANCELLED: "gray",
  PRESENT: "teal",
  LATE: "yellow",
  HALF_DAY: "orange",
  ON_LEAVE: "blue",
  ABSENT: "red",
  NOT_IN: "gray",
  HOLIDAY: "gray",
  WEEKLY_OFF: "gray",
  ACTIVE: "teal",
  INACTIVE: "gray",
  DRAFT: "yellow",
  PAID: "teal",
  OPEN: "blue",
  CLOSED: "gray",
  DONE: "teal",
};
const STATUS_LABEL: Record<string, string> = {
  NOT_IN: "Not checked in",
  ON_LEAVE: "On leave",
  HALF_DAY: "Half day",
  WEEKLY_OFF: "Weekly off",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge color={STATUS_COLOR[status] ?? "gray"}>{label}</Badge>;
}

/** Achievement bar with an optional marker for where the team should be today. */
export function AchievementBar({ value, expected, w = 120 }: { value: number; expected?: number; w?: number | string }) {
  const color = value >= 100 ? "teal" : expected !== undefined ? (value >= expected * 0.85 ? (value >= expected ? "teal" : "yellow") : "red") : value >= 85 ? "yellow" : "red";
  return (
    <Tooltip label={expected !== undefined ? `${pct(value)} done · ${pct(expected)} expected by today` : pct(value, 1)}>
      <Box pos="relative" w={w}>
        <Progress value={Math.min(value, 100)} color={color} size={6} radius="xs" />
        {expected !== undefined && expected < 100 ? (
          <Box
            pos="absolute"
            top={-3}
            left={`${expected}%`}
            w={2}
            h={12}
            bg="gray.7"
            style={{ borderRadius: 1 }}
            aria-hidden
          />
        ) : null}
      </Box>
    </Tooltip>
  );
}

/** Month picker that writes ?month=YYYY-MM to the URL. */
export function MonthSelect({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select
      w={170}
      aria-label="Month"
      data={months.map((m) => ({ value: m, label: monthLabel(m) }))}
      value={value}
      onChange={(m) => {
        if (!m) return;
        router.push(`${pathname}?month=${m}`);
      }}
    />
  );
}

export function KeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <Stack gap={10}>
      {items.map((i) => (
        <Group key={i.label} justify="space-between" wrap="nowrap" gap="md">
          <Text size="sm" c="dimmed">
            {i.label}
          </Text>
          <Text size="sm" fw={500} ta="right">
            {i.value}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="lg">
      {children}
    </Text>
  );
}
