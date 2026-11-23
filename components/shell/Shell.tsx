"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ActionIcon, AppShell, Avatar, Badge, Box, Group, Menu, NavLink, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useFullscreen } from "@mantine/hooks";
import {
  IconBriefcase,
  IconCalendarEvent,
  IconCash,
  IconCertificate,
  IconCheck,
  IconChecklist,
  IconChevronDown,
  IconClockCheck,
  IconFileText,
  IconLayoutDashboard,
  IconMaximize,
  IconMinimize,
  IconReceiptRupee,
  IconShieldLock,
  IconTargetArrow,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { COMPANY_NAME, PRODUCT_NAME, type ModuleKey } from "@/lib/config";
import { api, notifyError } from "@/lib/client";
import { initials } from "@/lib/format";

export type ShellViewer = {
  id: string;
  name: string;
  roleName: string;
  /** HR = whole company, MANAGER = own branch, EMPLOYEE = own records */
  scope: "HR" | "MANAGER" | "EMPLOYEE";
  branchName: string;
  modules: ModuleKey[];
};

type Person = { id: string; name: string; designation: string; branch: string; roleName: string };

export function Shell({
  viewer,
  people,
  pendingApprovals,
  children,
}: {
  viewer: ShellViewer;
  people: Person[];
  pendingApprovals: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const { toggle: toggleFullscreen, fullscreen } = useFullscreen();
  const self = viewer.scope === "EMPLOYEE";

  // The sidebar shows only the modules this person's role includes.
  const all: { title: string; items: { module: ModuleKey; href: string; label: string; icon: typeof IconUsers; count?: number }[] }[] = [
    { title: "Overview", items: [{ module: "dashboard", href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard }] },
    {
      title: "People",
      items: [
        self
          ? { module: "employees", href: `/employees/${viewer.id}`, label: "My profile", icon: IconUsers }
          : { module: "employees", href: "/employees", label: "Employees", icon: IconUsers },
        { module: "attendance", href: "/attendance", label: "Attendance", icon: IconClockCheck },
        { module: "leave", href: "/leaves", label: "Leave", icon: IconCalendarEvent, count: pendingApprovals },
        { module: "documents", href: "/documents", label: self ? "My documents" : "Documents & letters", icon: IconFileText },
        { module: "training", href: "/training", label: self ? "My training" : "Training", icon: IconCertificate },
      ],
    },
    {
      title: "Hiring",
      items: [
        { module: "recruitment", href: "/recruitment", label: "Recruitment", icon: IconBriefcase },
        { module: "onboarding", href: "/onboarding", label: self ? "My onboarding" : "Onboarding & exit", icon: IconUserPlus },
      ],
    },
    {
      title: "Performance",
      items: [
        { module: "targets", href: "/targets", label: "Targets", icon: IconTargetArrow },
        { module: "incentives", href: "/incentives", label: "Incentives", icon: IconCash },
        { module: "appraisals", href: "/appraisals", label: "Appraisals", icon: IconChecklist },
      ],
    },
    {
      title: "Pay",
      items: [{ module: "payroll", href: "/payroll", label: viewer.scope === "HR" ? "Payroll" : "My payslips", icon: IconReceiptRupee }],
    },
    { title: "Admin", items: [{ module: "users", href: "/users", label: "Users & roles", icon: IconShieldLock }] },
  ];
  const sections = all
    .map((s) => ({ ...s, items: s.items.filter((i) => viewer.modules.includes(i.module)) }))
    .filter((s) => s.items.length);

  function switchTo(userId: string) {
    if (userId === viewer.id) return;
    startSwitch(async () => {
      try {
        await api("/api/role", "POST", { userId });
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        notifyError(e);
      }
    });
  }

  return (
    <AppShell header={{ height: 52 }} navbar={{ width: 224, breakpoint: "sm" }} padding="lg" styles={{ main: { background: "#f6f7f9" } }}>
      <AppShell.Header px="md" style={{ borderColor: "var(--mantine-color-gray-3)" }}>
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Box
              w={26}
              h={26}
              style={{
                background: "var(--mantine-color-brand-8)",
                borderRadius: 5,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {PRODUCT_NAME[0]}
            </Box>
            <Text fw={600} size="md">
              {PRODUCT_NAME}
            </Text>
            <Text size="sm" c="gray.5">
              /
            </Text>
            <Text size="sm" c="gray.7">
              {COMPANY_NAME}
            </Text>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Tooltip label={fullscreen ? "Exit full screen" : "Full screen"}>
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={toggleFullscreen} aria-label="Toggle full screen">
                {fullscreen ? <IconMinimize size={18} stroke={1.6} /> : <IconMaximize size={18} stroke={1.6} />}
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" width={300} shadow="md" disabled={switching}>
              <Menu.Target>
                <UnstyledButton px={8} py={4} style={{ borderRadius: 6 }} aria-label="Switch demo user">
                  <Group gap={10} wrap="nowrap">
                    <Avatar size={30} radius="xl" color="brand" variant="filled">
                      {initials(viewer.name)}
                    </Avatar>
                    <Box style={{ lineHeight: 1.2 }}>
                      <Text size="sm" fw={600}>
                        {viewer.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {viewer.roleName} · {viewer.branchName}
                      </Text>
                    </Box>
                    <IconChevronDown size={14} color="var(--mantine-color-gray-6)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>View the demo as</Menu.Label>
                {people.map((p) => (
                  <Menu.Item key={p.id} onClick={() => switchTo(p.id)} rightSection={p.id === viewer.id ? <IconCheck size={14} /> : null}>
                    <Text size="sm" fw={500}>
                      {p.roleName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {p.name} · {p.designation}, {p.branch}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar style={{ borderColor: "var(--mantine-color-gray-3)" }}>
        <ScrollArea p="xs">
          <Stack gap="md" pt={4}>
            {sections.map((section) => (
              <Box key={section.title}>
                <Text size="11px" fw={600} c="gray.6" tt="uppercase" px={10} mb={4} style={{ letterSpacing: 0.4 }}>
                  {section.title}
                </Text>
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      component={Link}
                      href={item.href}
                      label={item.label}
                      active={active}
                      leftSection={<Icon size={17} stroke={1.6} />}
                      rightSection={
                        item.count ? (
                          <Badge size="xs" variant="filled" color="brand" circle={item.count < 10}>
                            {item.count}
                          </Badge>
                        ) : null
                      }
                      styles={{
                        root: { borderRadius: 5, padding: "6px 10px" },
                        label: { fontSize: 13, fontWeight: active ? 600 : 500 },
                      }}
                    />
                  );
                })}
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
