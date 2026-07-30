import { createColumnHelper } from "@tanstack/react-table";
import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, DataTable, EmptyStatePanel } from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminPageHeader } from "./page-header";

type UsageRow = {
  modelRef: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number | null;
  status: string;
};

const helper = createColumnHelper<UsageRow>();

export function UsageAdmin() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminFetch<{ usage: UsageRow[] }>("/api/admin/usage").then((r) => {
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRows(r.data.usage ?? []);
    });
  }, []);

  const columns = useMemo(
    () => [
      helper.accessor("modelRef", {
        header: "Model",
        cell: (c) => <code className="table-mono">{c.getValue()}</code>,
      }),
      helper.accessor("inputTokens", {
        header: "In",
        cell: (c) => c.getValue().toLocaleString(),
      }),
      helper.accessor("outputTokens", {
        header: "Out",
        cell: (c) => c.getValue().toLocaleString(),
      }),
      helper.accessor("costMicros", {
        header: "Cost (USD)",
        cell: (c) => {
          const v = c.getValue();
          return v == null ? (
            <span className="text-text-faint">—</span>
          ) : (
            `$${(v / 1_000_000).toFixed(4)}`
          );
        },
      }),
      helper.accessor("status", {
        header: "Status",
        cell: (c) => <Badge>{c.getValue()}</Badge>,
      }),
    ],
    [],
  );

  return (
    <div>
      <AdminPageHeader
        title="Usage"
        description="Recent token usage and estimated cost from model rates (offering or pattern defaults)."
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
              icon={Activity}
              title="No usage yet"
              description="Completed chat turns appear here with token counts and cost when priced."
            />
          }
        />
      )}
    </div>
  );
}
