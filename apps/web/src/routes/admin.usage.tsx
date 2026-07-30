import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, AdminTable } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/usage")({
  component: AdminUsage,
});

function AdminUsage() {
  const gate = useAdminGate();
  const [rows, setRows] = useState<
    Array<{
      modelRef: string;
      inputTokens: number;
      outputTokens: number;
      costMicros: number | null;
      status: string;
    }>
  >([]);

  useEffect(() => {
    if (gate.status !== "ready") return;
    void fetch("/api/admin/usage", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { usage?: typeof rows }) => setRows(d.usage ?? []));
  }, [gate]);

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Usage" active="/admin/usage">
        <AdminTable
          headers={["Model", "In", "Out", "Cost (µ$)", "Status"]}
          rows={rows.map((r) => [
            r.modelRef,
            String(r.inputTokens),
            String(r.outputTokens),
            r.costMicros == null ? "—" : String(r.costMicros),
            r.status,
          ])}
        />
      </AdminShell>
    </AdminGateFrame>
  );
}
