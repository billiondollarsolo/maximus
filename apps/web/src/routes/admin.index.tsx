import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/features/admin/admin-shell";
import { OverviewDashboard } from "#/features/admin/overview-dashboard";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const gate = useAdminGate();

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Overview" active="/admin">
        <OverviewDashboard />
      </AdminShell>
    </AdminGateFrame>
  );
}
