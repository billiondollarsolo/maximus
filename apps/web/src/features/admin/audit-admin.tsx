import { createColumnHelper } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DataTable, EmptyStatePanel, Input, Label } from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminPageHeader } from "./page-header";

type AuditRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

const helper = createColumnHelper<AuditRow>();

export function AuditAdmin() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [sinceDays, setSinceDays] = useState("30");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    const days = Number(sinceDays);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      params.set("since", since.toISOString());
    }
    params.set("limit", "200");
    const r = await adminFetch<{ events: AuditRow[] }>(
      `/api/admin/audit?${params.toString()}`,
    );
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setRows(r.data.events ?? []);
  }, [action, sinceDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(
    () => [
      helper.accessor("createdAt", {
        header: "When",
        cell: (c) => {
          const d = new Date(c.getValue());
          return (
            <span className="whitespace-nowrap text-xs text-text-muted tabular-nums">
              {Number.isNaN(d.getTime())
                ? "—"
                : d.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          );
        },
      }),
      helper.accessor("actorEmail", {
        header: "Actor",
        cell: (c) => {
          const email = c.getValue();
          const name = c.row.original.actorName;
          if (!email && !name) {
            return <span className="text-text-faint">system</span>;
          }
          return (
            <span className="text-sm text-text-secondary">
              {name || email}
              {name && email ? (
                <span className="block text-[11px] text-text-faint">{email}</span>
              ) : null}
            </span>
          );
        },
      }),
      helper.accessor("action", {
        header: "Action",
        cell: (c) => <Badge>{c.getValue()}</Badge>,
      }),
      helper.accessor("resourceType", {
        header: "Resource",
        cell: (c) => (
          <span className="text-text-secondary">{c.getValue()}</span>
        ),
      }),
      helper.accessor("resourceId", {
        header: "Id",
        cell: (c) =>
          c.getValue() ? (
            <code className="table-mono text-[11px]">{c.getValue()}</code>
          ) : (
            <span className="text-text-faint">—</span>
          ),
      }),
      helper.display({
        id: "meta",
        header: "Meta",
        cell: (c) => {
          const meta = c.row.original.meta;
          if (!meta || !Object.keys(meta).length) {
            return <span className="text-text-faint">—</span>;
          }
          return (
            <code className="table-mono max-w-[12rem] truncate text-[10px] text-text-faint">
              {JSON.stringify(meta)}
            </code>
          );
        },
      }),
    ],
    [],
  );

  return (
    <div>
      <AdminPageHeader
        title="Audit log"
        description="Admin mutations (providers, models, members, prices, settings). No chat message bodies."
      />
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="audit-action" className="text-xs">
            Action contains
          </Label>
          <Input
            id="audit-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. provider."
            className="mt-1 w-44"
          />
        </div>
        <div>
          <Label htmlFor="audit-since" className="text-xs">
            Last N days
          </Label>
          <Input
            id="audit-since"
            type="number"
            min={1}
            max={365}
            value={sinceDays}
            onChange={(e) => setSinceDays(e.target.value)}
            className="mt-1 w-24"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(r) => r.id}
          empty={
            <EmptyStatePanel
              icon={ScrollText}
              title="No audit events"
              description="Creating providers, rotating keys, and similar actions write here."
            />
          }
        />
      )}
    </div>
  );
}
