"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Box, Button, Checkbox, Group, Modal, Paper, ScrollArea, Select, Stack, Table, Tabs, Text, TextInput } from "@mantine/core";
import { IconLock, IconPlus } from "@tabler/icons-react";
import { BASE_LABEL, MODULES, type ModuleKey } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/primitives";

export type RoleRow = { id: number; name: string; base: string; locked: boolean; modules: ModuleKey[]; users: number };
export type UserRow = { id: number; name: string; code: string; designation: string; branch: string; roleId: number | null; roleName: string };

const KEYS = Object.keys(MODULES) as ModuleKey[];
const same = (a: ModuleKey[], b: ModuleKey[]) => a.length === b.length && a.every((k) => b.includes(k));

export function UsersView({ roles, users, viewerId }: { roles: RoleRow[]; users: UserRow[]; viewerId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // Unsaved module ticks, per role.
  const [draft, setDraft] = useState<Record<number, ModuleKey[]>>({});
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; base: string; modules: ModuleKey[] }>({ name: "", base: "EMPLOYEE", modules: ["dashboard"] });
  const [roleFilter, setRoleFilter] = useState("ALL");

  async function run(key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(key);
    try {
      await fn();
      notifyOk(ok);
      after?.();
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  const modulesOf = (r: RoleRow) => draft[r.id] ?? r.modules;
  const toggle = (r: RoleRow, key: ModuleKey, on: boolean) =>
    setDraft((d) => ({ ...d, [r.id]: on ? [...modulesOf(r), key] : modulesOf(r).filter((k) => k !== key) }));
  const dirty = (r: RoleRow) => !!draft[r.id] && !same(draft[r.id], r.modules);

  const userColumns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      value: (u) => u.name,
      render: (u) => (
        <Box>
          <Text size="sm" fw={500}>
            {u.name}
          </Text>
          <Text size="xs" c="dimmed">
            {u.designation} · {u.code}
          </Text>
        </Box>
      ),
    },
    { key: "branch", header: "Branch", value: (u) => u.branch },
    {
      key: "role",
      header: "Role",
      width: 240,
      value: (u) => u.roleName,
      render: (u) =>
        u.id === viewerId ? (
          <Group gap={6}>
            <Badge color="brand">{u.roleName}</Badge>
            <Text size="xs" c="dimmed">
              You
            </Text>
          </Group>
        ) : (
          <Select
            size="xs"
            aria-label={`Role for ${u.name}`}
            value={u.roleId ? String(u.roleId) : null}
            disabled={busy === `u-${u.id}`}
            data={roles.map((r) => ({ value: String(r.id), label: r.name }))}
            onChange={(v) => v && Number(v) !== u.roleId && run(`u-${u.id}`, () => api(`/api/users/${u.id}`, "PATCH", { roleId: Number(v) }), `${u.name} is now ${roles.find((r) => String(r.id) === v)?.name}.`)}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle="A role decides which modules a person can open and how much data they see"
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New role
          </Button>
        }
      />

      <Tabs defaultValue="roles" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="roles">Roles and module access</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="roles">
          <Paper withBorder>
            <ScrollArea type="auto">
              <Table withColumnBorders>
                <Table.Thead bg="gray.0">
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 190 }}>Module</Table.Th>
                    {roles.map((r) => (
                      <Table.Th key={r.id} ta="center" style={{ minWidth: 130 }}>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {r.locked ? <IconLock size={12} /> : null}
                          <Text size="sm" fw={600} c="dark">
                            {r.name}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed" fw={400}>
                          {BASE_LABEL[r.base]} · {r.users} user{r.users === 1 ? "" : "s"}
                        </Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {KEYS.map((key) => (
                    <Table.Tr key={key}>
                      <Table.Td fw={500}>{MODULES[key]}</Table.Td>
                      {roles.map((r) => (
                        <Table.Td key={r.id}>
                          <Group justify="center">
                            <Checkbox
                              aria-label={`${MODULES[key]} for ${r.name}`}
                              checked={modulesOf(r).includes(key)}
                              // The admin role is fixed, and everyone keeps the dashboard.
                              disabled={r.locked || key === "dashboard"}
                              onChange={(e) => toggle(r, key, e.currentTarget.checked)}
                            />
                          </Group>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td />
                    {roles.map((r) => (
                      <Table.Td key={r.id}>
                        <Stack gap={4} align="center">
                          {r.locked ? (
                            <Text size="xs" c="dimmed">
                              Full access
                            </Text>
                          ) : (
                            <>
                              <Button
                                size="compact-xs"
                                disabled={!dirty(r)}
                                loading={busy === `r-${r.id}`}
                                onClick={() =>
                                  run(`r-${r.id}`, () => api(`/api/roles/${r.id}`, "PATCH", { modules: modulesOf(r) }), `${r.name} updated.`, () =>
                                    setDraft((d) => {
                                      const next = { ...d };
                                      delete next[r.id];
                                      return next;
                                    }),
                                  )
                                }
                              >
                                Save
                              </Button>
                              {r.users === 0 ? (
                                <Button size="compact-xs" variant="subtle" color="red" loading={busy === `del-${r.id}`} onClick={() => run(`del-${r.id}`, () => api(`/api/roles/${r.id}`, "DELETE"), `${r.name} deleted.`)}>
                                  Delete
                                </Button>
                              ) : null}
                            </>
                          )}
                        </Stack>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
          <Text size="xs" c="dimmed" mt="xs">
            Data scope is fixed per role: whole company, own branch, or own records only. Within a module, people who see the whole company can make changes, branch managers act on their own branch, and employees act on their own records.
          </Text>
        </Tabs.Panel>

        <Tabs.Panel value="users">
          <DataTable
            rows={users.filter((u) => roleFilter === "ALL" || String(u.roleId) === roleFilter)}
            columns={userColumns}
            rowKey={(u) => u.id}
            searchPlaceholder="Search user"
            csvName="users-and-roles"
            maxHeight={620}
            filters={
              <Select
                w={200}
                aria-label="Role"
                value={roleFilter}
                onChange={(v) => setRoleFilter(v ?? "ALL")}
                data={[{ value: "ALL", label: "All roles" }, ...roles.map((r) => ({ value: String(r.id), label: r.name }))]}
              />
            }
          />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={creating} onClose={() => setCreating(false)} title={<Text fw={600}>New role</Text>} size="md">
        <Stack gap="md">
          <TextInput label="Role name" placeholder="e.g. Area Manager, Auditor" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))} data-autofocus />
          <Select label="Data this role can see" data={Object.entries(BASE_LABEL).map(([value, label]) => ({ value, label }))} value={form.base} onChange={(v) => setForm((f) => ({ ...f, base: v ?? "EMPLOYEE" }))} />
          <Box>
            <Text size="sm" fw={500} mb={6}>
              Modules
            </Text>
            <Group gap="md">
              {KEYS.map((key) => (
                <Checkbox
                  key={key}
                  label={MODULES[key]}
                  w={180}
                  checked={form.modules.includes(key)}
                  disabled={key === "dashboard"}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    setForm((f) => ({ ...f, modules: on ? [...f.modules, key] : f.modules.filter((k) => k !== key) }));
                  }}
                />
              ))}
            </Group>
          </Box>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "new"}
              disabled={!form.name.trim()}
              onClick={() =>
                run("new", () => api("/api/roles", "POST", form), `${form.name} created. Assign people to it under Users.`, () => {
                  setCreating(false);
                  setForm({ name: "", base: "EMPLOYEE", modules: ["dashboard"] });
                })
              }
            >
              Create role
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
