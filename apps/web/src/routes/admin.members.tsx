import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/features/admin/admin-shell";
import { MembersAdmin } from "#/features/admin/members-admin";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersPage,
});

function AdminMembersPage() {
  const gate = useAdminGate();
  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Members" active="/admin/members">
        <MembersAdmin />
      </AdminShell>
    </AdminGateFrame>
  );
}
