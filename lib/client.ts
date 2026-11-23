"use client";

import { notifications } from "@mantine/notifications";

/** Calls an /api route and throws the server's message on failure. */
export async function api<T = unknown>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Something went wrong. Try again.");
  return json.data as T;
}

export function notifyOk(message: string) {
  notifications.show({ message, color: "teal", autoClose: 2500 });
}

export function notifyError(e: unknown) {
  notifications.show({
    title: "Couldn't complete that",
    message: e instanceof Error ? e.message : "Something went wrong. Try again.",
    color: "red",
    autoClose: 5000,
  });
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
