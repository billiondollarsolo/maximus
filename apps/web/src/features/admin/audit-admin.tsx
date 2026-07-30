import { createColumnHelper } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, DataTable, EmptyStatePanel } from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminPageHeader } from "./page-header";

type AuditRow = {
  action: string;
  resourceType: string;
  resourceId: string | null;
};

const helper = createColumnHelper<AuditRow>();

export function AuditAdmin() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminFetch<{ events: AuditRow[] }>("/api/admin/audit").then((r) => {
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRows(r.data.events ?? []);
    });
  }, []);

  const columns = useMemo(
    () => [
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
            <code className="table-mono">{c.getValue()}</code>
          ) : (
            <span className="text-text-faint">—</span>
          ),
      }),
    ],
    [],
  );

  return (
    <div>
      <AdminPageHeader
        title="Audit log"
        description="Admin-grade mutations (providers, models, members, prices). No message bodies."
      />
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(_, i) => String(i)}
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
