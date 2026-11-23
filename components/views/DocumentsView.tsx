"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionIcon, Badge, Box, Button, FileInput, Group, Modal, Paper, Select, Stack, Tabs, Text } from "@mantine/core";
import { IconPrinter, IconTrash, IconUpload, IconWriting } from "@tabler/icons-react";
import { COMPANY_NAME, DOCUMENT_KINDS, MAX_UPLOAD_BYTES } from "@/lib/config";
import { api, notifyError, notifyOk } from "@/lib/client";
import { longDate } from "@/lib/dates";
import { LETTERS } from "@/lib/letters";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/primitives";

export type DocRow = { id: number; employeeId: number; name: string; code: string; branch: string; kind: string; fileName: string; size: number; uploadedBy: string; uploadedOn: string; verified: boolean; verifiedBy: string | null };
export type LetterRow = { id: number; employeeId: number; name: string; code: string; branch: string; type: string; body: string; issuedBy: string; issuedOn: string };
type Person = { id: number; name: string; branch: string };

/** Opens the letter on a clean page and sends it to the printer (or "Save as PDF"). */
function printLetter(l: LetterRow) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return notifyError(new Error("Allow pop-ups for this site to print the letter."));
  w.document.write(
    `<!doctype html><html><head><title>${esc(LETTERS[l.type]?.label ?? "Letter")} - ${esc(l.name)}</title><style>body{font-family:Georgia,serif;font-size:14px;line-height:1.7;margin:56px;color:#111}h1{font-size:18px;margin:0 0 28px}pre{white-space:pre-wrap;font:inherit;margin:0}</style></head><body><h1>${esc(COMPANY_NAME)}</h1><pre>${esc(l.body)}</pre></body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function DocumentsView({
  role,
  viewerId,
  docs,
  letters,
  people,
}: {
  role: "HR" | "MANAGER" | "EMPLOYEE";
  viewerId: number;
  docs: DocRow[];
  letters: LetterRow[];
  people: Person[];
}) {
  const router = useRouter();
  const isHr = role === "HR";
  const self = role === "EMPLOYEE";
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(self ? String(viewerId) : null);
  const [kind, setKind] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [letterType, setLetterType] = useState<string | null>(null);
  const [openLetter, setOpenLetter] = useState<LetterRow | null>(null);

  const personOptions = people.map((p) => ({ value: String(p.id), label: `${p.name} · ${p.branch}` }));

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

  async function upload() {
    const form = new FormData();
    form.set("employeeId", employeeId ?? "");
    form.set("kind", kind ?? "");
    if (file) form.set("file", file);
    await run(
      "upload",
      async () => {
        const res = await fetch("/api/documents", { method: "POST", body: form });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Upload failed. Try again.");
      },
      "Document uploaded.",
      () => {
        setUploading(false);
        setFile(null);
        setKind(null);
        if (!self) setEmployeeId(null);
      },
    );
  }

  const docColumns: Column<DocRow>[] = [
    ...(self
      ? []
      : [
          {
            key: "name",
            header: "Employee",
            value: (d: DocRow) => d.name,
            render: (d: DocRow) => (
              <Box>
                <Text size="sm" fw={500}>
                  {d.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {d.branch} · {d.code}
                </Text>
              </Box>
            ),
          },
        ]),
    { key: "kind", header: "Document", value: (d) => d.kind },
    {
      key: "file",
      header: "File",
      value: (d) => d.fileName,
      render: (d) => (
        <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="cell-link" style={{ color: "var(--mantine-color-brand-8)" }}>
          {d.fileName}
        </a>
      ),
    },
    { key: "size", header: "Size", align: "right", value: (d) => d.size, render: (d) => kb(d.size) },
    { key: "by", header: "Uploaded by", value: (d) => d.uploadedBy },
    { key: "on", header: "Uploaded", value: (d) => d.uploadedOn, render: (d) => longDate(d.uploadedOn) },
    {
      key: "verified",
      header: "Status",
      value: (d) => (d.verified ? "Verified" : "To verify"),
      render: (d) => (d.verified ? <Badge color="teal">Verified · {d.verifiedBy}</Badge> : <Badge color="yellow">To verify</Badge>),
    },
    {
      key: "act",
      header: "",
      noExport: true,
      align: "right",
      width: 150,
      render: (d) => (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          {isHr ? (
            <Button
              size="compact-xs"
              variant={d.verified ? "default" : "filled"}
              loading={busy === `v-${d.id}`}
              onClick={() => run(`v-${d.id}`, () => api(`/api/documents/${d.id}`, "PATCH", { verified: !d.verified }), d.verified ? "Marked as not verified." : `${d.kind} verified.`)}
            >
              {d.verified ? "Unverify" : "Verify"}
            </Button>
          ) : null}
          {isHr || (self && !d.verified) ? (
            <ActionIcon variant="subtle" color="gray" aria-label={`Remove ${d.fileName}`} disabled={busy === `d-${d.id}`} onClick={() => run(`d-${d.id}`, () => api(`/api/documents/${d.id}`, "DELETE"), "Document removed.")}>
              <IconTrash size={15} />
            </ActionIcon>
          ) : null}
        </Group>
      ),
    },
  ];

  const letterColumns: Column<LetterRow>[] = [
    ...(self
      ? []
      : [
          {
            key: "name",
            header: "Employee",
            value: (l: LetterRow) => l.name,
            render: (l: LetterRow) => (
              <Box>
                <Text size="sm" fw={500}>
                  {l.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {l.branch} · {l.code}
                </Text>
              </Box>
            ),
          },
        ]),
    { key: "type", header: "Letter", value: (l) => LETTERS[l.type]?.label ?? l.type },
    { key: "by", header: "Issued by", value: (l) => l.issuedBy },
    { key: "on", header: "Issued", value: (l) => l.issuedOn, render: (l) => longDate(l.issuedOn) },
    {
      key: "act",
      header: "",
      noExport: true,
      align: "right",
      render: (l) => (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          <Button size="compact-xs" variant="default" onClick={() => setOpenLetter(l)}>
            Open
          </Button>
          {isHr ? (
            <ActionIcon variant="subtle" color="gray" aria-label="Withdraw letter" disabled={busy === `l-${l.id}`} onClick={() => run(`l-${l.id}`, () => api(`/api/letters/${l.id}`, "DELETE"), "Letter withdrawn.")}>
              <IconTrash size={15} />
            </ActionIcon>
          ) : null}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={self ? "My documents" : "Documents & letters"}
        subtitle={self ? "Your KYC documents and the letters HR has issued to you" : "KYC documents on file and letters issued from templates"}
        actions={
          <>
            <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => setUploading(true)}>
              Upload document
            </Button>
            {isHr ? (
              <Button leftSection={<IconWriting size={16} />} onClick={() => setIssuing(true)}>
                Issue letter
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="docs" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="docs" rightSection={isHr && docs.some((d) => !d.verified) ? <Badge size="xs" variant="filled" color="brand" circle>{docs.filter((d) => !d.verified).length}</Badge> : null}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="letters">Letters</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="docs">
          <DataTable rows={docs} columns={docColumns} rowKey={(d) => d.id} searchPlaceholder={self ? undefined : "Search employee or document"} csvName={self ? undefined : "documents"} empty="No documents uploaded yet." />
        </Tabs.Panel>
        <Tabs.Panel value="letters">
          <DataTable rows={letters} columns={letterColumns} rowKey={(l) => l.id} searchPlaceholder={self ? undefined : "Search employee or letter"} empty={isHr ? "No letters issued yet. Use Issue letter." : "No letters issued yet."} />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={uploading} onClose={() => setUploading(false)} title={<Text fw={600}>Upload document</Text>} size="sm">
        <Stack gap="md">
          {self ? null : <Select label="Employee" placeholder="Search by name" searchable data={personOptions} value={employeeId} onChange={setEmployeeId} />}
          <Select label="Document type" placeholder="Choose" data={DOCUMENT_KINDS} value={kind} onChange={setKind} />
          <FileInput
            label="File"
            placeholder="PDF, JPG or PNG, up to 2 MB"
            accept="application/pdf,image/jpeg,image/png"
            value={file}
            onChange={setFile}
            clearable
            error={file && file.size > MAX_UPLOAD_BYTES ? "File is larger than 2 MB" : undefined}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setUploading(false)}>
              Cancel
            </Button>
            <Button onClick={upload} loading={busy === "upload"} disabled={!employeeId || !kind || !file || file.size > MAX_UPLOAD_BYTES}>
              Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={issuing} onClose={() => setIssuing(false)} title={<Text fw={600}>Issue letter</Text>} size="sm">
        <Stack gap="md">
          <Select label="Employee" placeholder="Search by name" searchable data={personOptions} value={employeeId} onChange={setEmployeeId} />
          <Select label="Letter" placeholder="Choose" data={Object.entries(LETTERS).map(([value, l]) => ({ value, label: l.label }))} value={letterType} onChange={setLetterType} />
          <Text size="xs" c="dimmed">
            The letter is filled from the employee record (name, designation, branch, joining date, CTC) and saved. The employee can see it under My documents.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setIssuing(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "issue"}
              disabled={!employeeId || !letterType}
              onClick={() =>
                run("issue", () => api("/api/letters", "POST", { employeeId: Number(employeeId), type: letterType }), "Letter issued.", () => {
                  setIssuing(false);
                  setLetterType(null);
                  setEmployeeId(null);
                })
              }
            >
              Issue letter
            </Button>
          </Group>
        </Stack>
      </Modal>

      {openLetter ? (
        <Modal opened onClose={() => setOpenLetter(null)} size="lg" title={<Text fw={600}>{LETTERS[openLetter.type]?.label ?? "Letter"} · {openLetter.name}</Text>}>
          <Paper withBorder p="lg">
            <Text fw={700} fz={16}>
              {COMPANY_NAME}
            </Text>
            <Text size="sm" mt="md" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {openLetter.body}
            </Text>
          </Paper>
          <Group justify="flex-end" mt="md" gap="xs">
            <Button variant="default" onClick={() => setOpenLetter(null)}>
              Close
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={() => printLetter(openLetter)}>
              Print / save as PDF
            </Button>
          </Group>
        </Modal>
      ) : null}
    </>
  );
}
