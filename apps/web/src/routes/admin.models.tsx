import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Input } from "#/components/ui";
import { AdminShell, AdminTable } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/models")({
  component: AdminModels,
});

function AdminModels() {
  const gate = useAdminGate();
  const [models, setModels] = useState<
    Array<{ modelRef: string; displayName: string; isEnabled: boolean }>
  >([]);
  const [allowlist, setAllowlist] = useState<
    Array<{ modelRef: string; role: string | null }>
  >([]);
  const [modelRef, setModelRef] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/models", {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      models: Array<{
        modelRef: string;
        displayName: string;
        isEnabled: boolean;
      }>;
      allowlist: Array<{ modelRef: string; role: string | null }>;
    };
    setModels(data.models);
    setAllowlist(data.allowlist);
  }

  useEffect(() => {
    if (gate.status === "ready") void refresh();
  }, [gate]);

  async function addAllow() {
    await fetch("/api/admin/models", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "allowlist",
        modelRef,
        role: null,
      }),
    });
    setModelRef("");
    await refresh();
  }

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Models" active="/admin/models">
        <h2 className="mb-2 text-sm font-semibold">Org models</h2>
        <AdminTable
          headers={["Display", "Ref", "Enabled"]}
          rows={models.map((m) => [
            m.displayName,
            m.modelRef,
            m.isEnabled ? "yes" : "no",
          ])}
        />
        <h2 className="mb-2 mt-8 text-sm font-semibold">Allowlist</h2>
        <p className="mb-3 text-sm text-text-muted">
          Empty allowlist = all enabled models. Non-empty restricts chat by role.
        </p>
        <div className="mb-4 flex gap-2">
          <Input
            value={modelRef}
            onChange={(e) => setModelRef(e.target.value)}
            placeholder="openai:platform:gpt-4.1"
            className="flex-1"
          />
          <Button type="button" onClick={() => void addAllow()}>
            Add rule
          </Button>
        </div>
        <AdminTable
          headers={["Model ref", "Role"]}
          rows={allowlist.map((a) => [a.modelRef, a.role ?? "all"])}
        />
      </AdminShell>
    </AdminGateFrame>
  );
}
