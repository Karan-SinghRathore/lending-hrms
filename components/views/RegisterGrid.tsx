"use client";

import Link from "next/link";
import { Box, Group, ScrollArea, Table, Text } from "@mantine/core";
import { parseDate } from "@/lib/dates";

export type RegisterRowData = {
  id: number;
  name: string;
  code: string;
  branch: string;
  designation: string;
  days: string[];
  present: number;
  late: number;
  leave: number;
  absent: number;
};

const CELL: Record<string, { code: string; label: string; color?: string; bg?: string }> = {
  PRESENT: { code: "P", label: "Present", color: "var(--mantine-color-teal-8)" },
  LATE: { code: "L", label: "Late", color: "var(--mantine-color-yellow-9)", bg: "var(--mantine-color-yellow-0)" },
  HALF_DAY: { code: "½", label: "Half day", color: "var(--mantine-color-orange-8)", bg: "var(--mantine-color-orange-0)" },
  ON_LEAVE: { code: "LV", label: "On leave", color: "var(--mantine-color-blue-8)", bg: "var(--mantine-color-blue-0)" },
  ABSENT: { code: "A", label: "Absent", color: "var(--mantine-color-red-8)", bg: "var(--mantine-color-red-0)" },
  NOT_IN: { code: "·", label: "Not checked in yet", color: "var(--mantine-color-gray-6)" },
  HOLIDAY: { code: "H", label: "Holiday", color: "var(--mantine-color-gray-6)", bg: "var(--mantine-color-gray-1)" },
  WEEKLY_OFF: { code: "", label: "Weekly off", bg: "var(--mantine-color-gray-1)" },
  UPCOMING: { code: "", label: "" },
};

export function RegisterLegend() {
  return (
    <Group gap="md">
      {(["PRESENT", "LATE", "HALF_DAY", "ON_LEAVE", "ABSENT", "HOLIDAY"] as const).map((k) => (
        <Group key={k} gap={6}>
          <Box
            w={20}
            h={18}
            style={{
              background: CELL[k].bg ?? "#fff",
              border: "1px solid var(--mantine-color-gray-3)",
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              fontWeight: 600,
              color: CELL[k].color,
            }}
          >
            {CELL[k].code}
          </Box>
          <Text size="xs" c="dimmed">
            {CELL[k].label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}

export function RegisterGrid({ days, rows, linkNames = true }: { days: string[]; rows: RegisterRowData[]; linkNames?: boolean }) {
  return (
    <ScrollArea type="auto">
      <Table className="register" withRowBorders>
        <Table.Thead bg="gray.0">
          <Table.Tr>
            <Table.Th className="sticky-col" style={{ background: "var(--mantine-color-gray-0)" }}>
              <Text size="xs" fw={600} c="gray.7">
                Employee
              </Text>
            </Table.Th>
            {days.map((d) => {
              const date = parseDate(d);
              const sunday = date.getDay() === 0;
              return (
                <Table.Th key={d} className={sunday ? "weekend" : undefined}>
                  <div>{date.getDate()}</div>
                  <div style={{ fontWeight: 400, fontSize: 9 }}>{"SMTWTFS"[date.getDay()]}</div>
                </Table.Th>
              );
            })}
            {["P", "L", "LV", "A"].map((h) => (
              <Table.Th key={h} style={{ minWidth: 34, background: "var(--mantine-color-gray-1)" }}>
                {h}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td className="sticky-col">
                {linkNames ? (
                  <Link href={`/employees/${r.id}`} className="cell-link">
                    <Text size="xs" fw={500} lineClamp={1}>
                      {r.name}
                    </Text>
                  </Link>
                ) : (
                  <Text size="xs" fw={500}>
                    {r.name}
                  </Text>
                )}
              </Table.Td>
              {r.days.map((status, i) => {
                const c = CELL[status] ?? CELL.UPCOMING;
                return (
                  <Table.Td
                    key={days[i]}
                    title={c.label ? `${parseDate(days[i]).getDate()} · ${c.label}` : undefined}
                    style={{ background: c.bg, color: c.color, fontWeight: 600 }}
                  >
                    {c.code}
                  </Table.Td>
                );
              })}
              <Table.Td style={{ fontWeight: 600 }}>{r.present}</Table.Td>
              <Table.Td>{r.late || ""}</Table.Td>
              <Table.Td>{r.leave || ""}</Table.Td>
              <Table.Td style={{ color: r.absent ? "var(--mantine-color-red-8)" : undefined, fontWeight: r.absent ? 600 : 400 }}>
                {r.absent || ""}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
