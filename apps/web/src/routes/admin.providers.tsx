import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/features/admin/admin-shell";
import { ProvidersAdmin } from "#/features/admin/providers-admin";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/providers")({
  component: AdminProvidersPage,
});

function AdminProvidersPage() {
  const gate = useAdminGate();
  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Providers" active="/admin/providers" hideTitle>
        <ProvidersAdmin />
      </AdminShell>
    </AdminGateFrame>
  );
}
