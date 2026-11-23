"use client";

import { Paper, Text, Title } from "@mantine/core";
import { MODULES, type ModuleKey } from "@/lib/config";

export function NoAccess({ module, role }: { module: ModuleKey; role: string }) {
  return (
    <Paper withBorder p="lg" maw={560}>
      <Title order={2}>No access to {MODULES[module]}</Title>
      <Text size="sm" c="dimmed" mt={6}>
        Your role ({role}) does not include this module. An HR admin can change this under Users &amp; roles.
      </Text>
    </Paper>
  );
}
