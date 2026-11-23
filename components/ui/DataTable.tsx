"use client";

import { useMemo, useState } from "react";
import { ActionIcon, Box, Button, Group, Paper, ScrollArea, Table, Text, TextInput, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconDownload, IconSearch, IconSelector } from "@tabler/icons-react";
import { downloadCsv } from "@/lib/client";

export type Column<T> = {
  key: string;
  header: string;
  /** Cell content. Falls back to `value`. */
  render?: (row: T) => React.ReactNode;
  /** Raw value for sorting, search and CSV export. */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  /** Leave out of the CSV export (e.g. action buttons). */
  noExport?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder,
  filters,
  csvName,
  onRowClick,
  maxHeight = 560,
  initialSort,
  empty = "Nothing to show.",
  footer,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  csvName?: string;
  onRowClick?: (row: T) => void;
  maxHeight?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  empty?: string;
  footer?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);

  const visible = useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.value?.(r);
          return v != null && String(v).toLowerCase().includes(q);
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.value) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const va = col.value!(a);
          const vb = col.value!(b);
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        });
      }
    }
    return out;
  }, [rows, columns, query, sort]);

  function toggleSort(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  function exportCsv() {
    const cols = columns.filter((c) => !c.noExport && c.value);
    downloadCsv(
      `${csvName}.csv`,
      cols.map((c) => c.header),
      visible.map((r) => cols.map((c) => c.value!(r))),
    );
  }

  const showToolbar = searchPlaceholder || filters || csvName;

  return (
    <Paper withBorder>
      {showToolbar ? (
        <Group justify="space-between" px="sm" py={8} gap="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
          <Group gap="xs">
            {searchPlaceholder ? (
              <TextInput
                w={240}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                leftSection={<IconSearch size={15} />}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            ) : null}
            {filters}
          </Group>
          <Group gap="sm">
            <Text size="xs" c="dimmed" className="num">
              {visible.length === rows.length ? `${rows.length} rows` : `${visible.length} of ${rows.length} rows`}
            </Text>
            {csvName ? (
              <Button variant="default" leftSection={<IconDownload size={15} />} onClick={exportCsv}>
                Export CSV
              </Button>
            ) : null}
          </Group>
        </Group>
      ) : null}

      <ScrollArea.Autosize mah={maxHeight} type="auto">
        <Table highlightOnHover={!!onRowClick} stickyHeader withRowBorders>
          <Table.Thead bg="gray.0">
            <Table.Tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false && !!c.value;
                const active = sort?.key === c.key;
                return (
                  <Table.Th key={c.key} w={c.width} ta={c.align} style={{ whiteSpace: "nowrap" }}>
                    <Group gap={2} wrap="nowrap" justify={c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start"}>
                      <Text size="xs" fw={600} c="gray.7">
                        {c.header}
                      </Text>
                      {sortable ? (
                        <Tooltip label="Sort">
                          <ActionIcon variant="transparent" color={active ? "brand" : "gray.5"} size={16} onClick={() => toggleSort(c.key)} aria-label={`Sort by ${c.header}`}>
                            {active ? sort!.dir === "asc" ? <IconArrowUp size={13} /> : <IconArrowDown size={13} /> : <IconSelector size={13} />}
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                    </Group>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visible.map((row) => (
              <Table.Tr key={rowKey(row)} className={onRowClick ? "link-row" : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <Table.Td key={c.key} ta={c.align}>
                    {c.render ? c.render(row) : (c.value?.(row) ?? "—")}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {visible.length === 0 ? (
          <Box py="xl">
            <Text size="sm" c="dimmed" ta="center">
              {empty}
            </Text>
          </Box>
        ) : null}
      </ScrollArea.Autosize>
      {footer ? (
        <Box px="sm" py={8} style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
          {footer}
        </Box>
      ) : null}
    </Paper>
  );
}
