import { createFileRoute } from "@tanstack/react-router";
import { AccessAdmin } from "#/features/admin/access-admin";
import { AdminShell } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/models")({
  component: AdminAccessPage,
});

function AdminAccessPage() {
  const gate = useAdminGate();
  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Access" active="/admin/models">
        <AccessAdmin />
      </AdminShell>
    </AdminGateFrame>
  );
}
