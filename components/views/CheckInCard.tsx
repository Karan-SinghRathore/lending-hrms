"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Box, Button, Group, Paper, Text } from "@mantine/core";
import { IconLogin2, IconLogout2, IconMapPin } from "@tabler/icons-react";
import { api, notifyError, notifyOk } from "@/lib/client";
import { longDate, timeOf, todayStr } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/primitives";

export type TodayAttendance = {
  checkIn: Date | null;
  checkOut: Date | null;
  location: string | null;
  status: string;
} | null;

function getPosition(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { timeout: 6000, maximumAge: 60000 },
    );
  });
}

function hoursBetween(a: Date, b: Date) {
  const mins = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function CheckInCard({ today, dayOff }: { today: TodayAttendance; dayOff?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(kind: "in" | "out") {
    setBusy(true);
    try {
      const pos = await getPosition();
      await api("/api/attendance", "POST", { kind, ...pos });
      notifyOk(kind === "in" ? "Checked in." : "Checked out.");
      router.refresh();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;

  return (
    <Paper withBorder p="md" h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" fw={500}>
            My attendance · {longDate(todayStr())}
          </Text>
          <Group gap="xs" mt={6}>
            <Text fz={20} fw={600} className="num" lh={1.2}>
              {checkedIn ? timeOf(today!.checkIn) : "Not checked in"}
            </Text>
            {checkedIn ? <StatusBadge status={today!.status} /> : null}
          </Group>
          {checkedIn ? (
            <Text size="xs" c="dimmed" mt={6}>
              <IconMapPin size={12} style={{ verticalAlign: -2 }} /> {today!.location ?? "Location not shared"}
              {checkedOut
                ? ` · Out ${timeOf(today!.checkOut)} · ${hoursBetween(today!.checkIn!, today!.checkOut!)}`
                : null}
            </Text>
          ) : (
            <Text size="xs" c="dimmed" mt={6}>
              {dayOff ? "No attendance needed today." : "Location is saved on check-in."}
            </Text>
          )}
        </Box>
        {dayOff ? null : !checkedIn ? (
          <Button leftSection={<IconLogin2 size={16} />} loading={busy} onClick={() => act("in")} style={{ flexShrink: 0 }}>
            Check in
          </Button>
        ) : !checkedOut ? (
          <Button variant="default" leftSection={<IconLogout2 size={16} />} loading={busy} onClick={() => act("out")} style={{ flexShrink: 0 }}>
            Check out
          </Button>
        ) : (
          <Text size="xs" c="dimmed">
            Day complete
          </Text>
        )}
      </Group>
    </Paper>
  );
}
