import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const gate = useAdminGate();
  const [usageCount, setUsageCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (gate.status !== "ready") return;
    void Promise.all([
      fetch("/api/admin/usage", { credentials: "same-origin" }).then((r) =>
        r.json(),
      ),
      fetch("/api/admin/members", { credentials: "same-origin" }).then((r) =>
        r.json(),
      ),
    ]).then(([u, m]: [{ usage?: unknown[] }, { members?: unknown[] }]) => {
      setUsageCount(u.usage?.length ?? 0);
      setMemberCount(m.members?.length ?? 0);
    });
  }, [gate]);

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Overview" active="/admin">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="Members" value={String(memberCount)} />
          <Card label="Recent usage events" value={String(usageCount)} />
          <Card label="Security" value="Invite-only · BYOK encrypted" />
        </div>
        <p className="mt-8 text-sm text-text-muted">
          Manage providers, model allowlists, and team access. Members never see
          this console.
        </p>
      </AdminShell>
    </AdminGateFrame>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-sidebar p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
