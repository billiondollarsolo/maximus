import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/features/admin/admin-shell";
import { UsageAdmin } from "#/features/admin/usage-admin";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/usage")({
  component: AdminUsagePage,
});

function AdminUsagePage() {
  const gate = useAdminGate();
  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Usage" active="/admin/usage">
        <UsageAdmin />
      </AdminShell>
    </AdminGateFrame>
  );
}
