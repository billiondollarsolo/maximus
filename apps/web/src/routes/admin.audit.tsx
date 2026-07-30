import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/features/admin/admin-shell";
import { AuditAdmin } from "#/features/admin/audit-admin";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAuditPage,
});

function AdminAuditPage() {
  const gate = useAdminGate();
  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Audit" active="/admin/audit">
        <AuditAdmin />
      </AdminShell>
    </AdminGateFrame>
  );
}
