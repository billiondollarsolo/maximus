import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, AdminTable } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const gate = useAdminGate();
  const [rows, setRows] = useState<
    Array<{ action: string; resourceType: string; resourceId: string | null }>
  >([]);

  useEffect(() => {
    if (gate.status !== "ready") return;
    void fetch("/api/admin/audit", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { events?: typeof rows }) => setRows(d.events ?? []));
  }, [gate]);

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Audit log" active="/admin/audit">
        <AdminTable
          headers={["Action", "Resource", "Id"]}
          rows={rows.map((r) => [
            r.action,
            r.resourceType,
            r.resourceId ?? "—",
          ])}
        />
      </AdminShell>
    </AdminGateFrame>
  );
}
