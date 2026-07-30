import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Input } from "#/components/ui";
import { AdminShell, AdminTable } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/providers")({
  component: AdminProviders,
});

function AdminProviders() {
  const gate = useAdminGate();
  const [rows, setRows] = useState<
    Array<{ id: string; name: string; kind: string; hasCredentials: boolean }>
  >([]);
  const [name, setName] = useState("OpenAI BYOK");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/providers", {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      connections: Array<{
        id: string;
        name: string;
        kind: string;
        hasCredentials: boolean;
      }>;
    };
    setRows(data.connections);
  }

  useEffect(() => {
    if (gate.status === "ready") void refresh();
  }, [gate]);

  async function add() {
    setError(null);
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "openai",
        name,
        apiKey,
        modelId: "gpt-4.1",
        displayName: "GPT-4.1 (BYOK)",
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      connection?: { isPlaintext?: boolean };
    };
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    if (data.connection?.isPlaintext) {
      setError("Server stored plaintext — abort");
      return;
    }
    setApiKey("");
    await refresh();
  }

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Providers" active="/admin/providers">
        <p className="mb-4 text-sm text-text-muted">
          API keys are encrypted at rest (AES-256-GCM). They are never shown
          again after save — only “•••• set”.
        </p>
        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Connection name"
          />
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            autoComplete="off"
          />
          <Button type="button" onClick={() => void add()}>
            Add encrypted connection
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <AdminTable
          headers={["Name", "Kind", "Secrets"]}
          rows={rows.map((r) => [
            r.name,
            r.kind,
            r.hasCredentials ? "•••• set" : "—",
          ])}
        />
      </AdminShell>
    </AdminGateFrame>
  );
}
