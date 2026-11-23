"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, Box, Button, Group, Select, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { longDate } from "@/lib/dates";
import { initials } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";

export type EmployeeRow = {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  branch: string;
  manager: string | null;
  joinDate: string;
  status: string;
};

export function EmployeesView({
  rows,
  showBranchFilter,
  canManage,
  branchList,
}: {
  rows: EmployeeRow[];
  showBranchFilter: boolean;
  canManage: boolean;
  branchList: { id: number; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const [branch, setBranch] = useState<string>("ALL");
  const [department, setDepartment] = useState<string>("ALL");

  const branches = useMemo(() => [...new Set(rows.map((r) => r.branch))].sort(), [rows]);
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const filtered = rows.filter(
    (r) => (branch === "ALL" || r.branch === branch) && (department === "ALL" || r.department === department),
  );

  const columns: Column<EmployeeRow>[] = [
    {
      key: "name",
      header: "Employee",
      value: (r) => r.name,
      render: (r) => (
        <Group gap={10} wrap="nowrap">
          <Avatar size={28} radius="xl" color="gray" variant="light">
            {initials(r.name)}
          </Avatar>
          <Box>
            <Text size="sm" fw={500}>
              {r.name}
            </Text>
            <Text size="xs" c="dimmed">
              {r.email}
            </Text>
          </Box>
        </Group>
      ),
    },
    { key: "code", header: "Code", value: (r) => r.code, width: 100 },
    { key: "designation", header: "Designation", value: (r) => r.designation },
    { key: "department", header: "Department", value: (r) => r.department },
    { key: "branch", header: "Branch", value: (r) => r.branch },
    { key: "manager", header: "Reports to", value: (r) => r.manager ?? "—" },
    { key: "phone", header: "Phone", value: (r) => r.phone, sortable: false },
    { key: "joined", header: "Joined", value: (r) => r.joinDate, render: (r) => longDate(r.joinDate) },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${rows.length} active employees`}
        actions={
          canManage ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
              Add employee
            </Button>
          ) : null
        }
      />
      {adding ? (
        <EmployeeFormModal
          branches={branchList}
          onClose={(saved, id) => {
            setAdding(false);
            if (saved && id) router.push(`/employees/${id}`);
          }}
        />
      ) : null}
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search name, code, designation"
        csvName="employees"
        maxHeight={640}
        onRowClick={(r) => router.push(`/employees/${r.id}`)}
        filters={
          <>
            {showBranchFilter ? (
              <Select
                w={150}
                aria-label="Branch"
                value={branch}
                onChange={(v) => setBranch(v ?? "ALL")}
                data={[{ value: "ALL", label: "All branches" }, ...branches.map((b) => ({ value: b, label: b }))]}
              />
            ) : null}
            <Select
              w={190}
              aria-label="Department"
              value={department}
              onChange={(v) => setDepartment(v ?? "ALL")}
              data={[{ value: "ALL", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]}
            />
          </>
        }
      />
    </>
  );
}
