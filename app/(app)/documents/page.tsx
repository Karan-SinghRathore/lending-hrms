import { NoAccess } from "@/components/ui/NoAccess";
import { DocumentsView } from "@/components/views/DocumentsView";
import { toDateStr } from "@/lib/dates";
import { documentPeople, listDocuments, listLetters } from "@/services/documents";
import { can, getViewer } from "@/services/viewer";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const viewer = await getViewer();
  if (!can(viewer, "documents")) return <NoAccess module="documents" role={viewer.roleName} />;
  const [docs, letters, people] = await Promise.all([listDocuments(viewer), listLetters(viewer), documentPeople(viewer)]);
  return (
    <DocumentsView
      role={viewer.role}
      viewerId={viewer.id}
      people={people}
      docs={docs.map((d) => ({
        id: d.id,
        employeeId: d.employeeId,
        name: d.employee.name,
        code: d.employee.code,
        branch: d.employee.branch.name,
        kind: d.kind,
        fileName: d.fileName,
        size: d.size,
        uploadedBy: d.uploadedBy,
        uploadedOn: toDateStr(d.uploadedAt),
        verified: d.verified,
        verifiedBy: d.verifiedBy,
      }))}
      letters={letters.map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        name: l.employee.name,
        code: l.employee.code,
        branch: l.employee.branch.name,
        type: l.type,
        body: l.body,
        issuedBy: l.issuedBy,
        issuedOn: toDateStr(l.issuedAt),
      }))}
    />
  );
}
