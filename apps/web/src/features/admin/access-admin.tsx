import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { Plus, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyStatePanel,
  Icon,
  Label,
  Select,
} from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminSection } from "./admin-section";
import { ConfirmDialog } from "./confirm-dialog";
import { AdminPageHeader } from "./page-header";

type AllowRow = {
  id: string;
  modelRef: string;
  role: string | null;
};

type ModelOpt = { modelRef: string; displayName: string };

const allowHelper = createColumnHelper<AllowRow>();
const platformHelper = createColumnHelper<{
  modelRef: string;
  displayName: string;
  providerKind: string;
}>();

export function AccessAdmin() {
  const [allowlist, setAllowlist] = useState<AllowRow[]>([]);
  const [catalogRefs, setCatalogRefs] = useState<ModelOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [allowRef, setAllowRef] = useState("");
  const [allowRole, setAllowRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<AllowRow | null>(null);

  const [platformRows, setPlatformRows] = useState<
    Array<{ modelRef: string; displayName: string; providerKind: string }>
  >([]);

  const refresh = useCallback(async () => {
    const r = await adminFetch<{
      models: Array<{ modelRef: string; displayName: string }>;
      platform?: Array<{
        modelRef: string;
        displayName: string;
        providerKind: string;
      }>;
      catalog?: Array<{ modelRef: string; displayName: string }>;
      allowlist: AllowRow[];
    }>("/api/admin/models");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAllowlist(r.data.allowlist ?? []);
    setPlatformRows(r.data.platform ?? []);
    // Prefer full composed catalog for allowlist picker (gated + discovered + org)
    if (r.data.catalog && r.data.catalog.length > 0) {
      setCatalogRefs(
        r.data.catalog.map((m) => ({
          modelRef: m.modelRef,
          displayName: m.displayName,
        })),
      );
    } else {
      const platform = (r.data.platform ?? []).map((m) => ({
        modelRef: m.modelRef,
        displayName: m.displayName,
      }));
      const org = (r.data.models ?? []).map((m) => ({
        modelRef: m.modelRef,
        displayName: m.displayName,
      }));
      const byRef = new Map<string, ModelOpt>();
      for (const m of [...platform, ...org]) byRef.set(m.modelRef, m);
      setCatalogRefs([...byRef.values()]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const platform = platformRows;

  const allowColumns = useMemo(
    () => [
      allowHelper.accessor("modelRef", {
        header: "Model ref",
        cell: (c) => <code className="table-mono">{c.getValue()}</code>,
      }),
      allowHelper.accessor("role", {
        header: "Role",
        cell: (c) => <Badge>{c.getValue() ?? "all roles"}</Badge>,
      }),
      allowHelper.display({
        id: "actions",
        header: "",
        cell: (c) => (
          <div className="row-actions">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setRemoveId(c.row.original)}
            >
              Remove
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const platformColumns = useMemo(
    () => [
      platformHelper.accessor("displayName", { header: "Display" }),
      platformHelper.accessor("modelRef", {
        header: "Ref",
        cell: (c) => <code className="table-mono">{c.getValue()}</code>,
      }),
      platformHelper.accessor("providerKind", {
        header: "Kind",
        cell: (c) => <Badge>{c.getValue()}</Badge>,
      }),
    ],
    [],
  );

  async function addRule() {
    setBusy(true);
    setError(null);
    const r = await adminFetch("/api/admin/models", {
      method: "POST",
      body: JSON.stringify({
        action: "allowlist_upsert",
        modelRef: allowRef,
        role: allowRole || null,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAddOpen(false);
    setAllowRef("");
    setAllowRole("");
    await refresh();
  }

  return (
    <div>
      <AdminPageHeader
        title="Access"
        description={
          <>
            Control who may use which models. Catalog and pricing live under{" "}
            <Link to="/admin/providers" className="text-accent underline">
              Providers
            </Link>
            .
          </>
        }
        actions={
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Add rule
          </Button>
        }
      />

      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}

      <AdminSection
        title="Allowlist"
        description="Empty allowlist means all enabled models. Non-empty restricts chat by model ref and optional role."
      >
        <DataTable
          data={allowlist}
          columns={allowColumns}
          getRowId={(r) => r.id}
          empty={
            <EmptyStatePanel
              icon={Shield}
              title="No allowlist rules"
              description="Everyone with chat access can use every enabled model. Add a rule to restrict."
              action={
                <Button type="button" onClick={() => setAddOpen(true)}>
                  <Icon icon={Plus} size="sm" />
                  Add rule
                </Button>
              }
            />
          }
        />
      </AdminSection>

      <AdminSection
        title="Platform models"
        description="Gated by credentials (live). Platform cloud models appear only when API keys are set. Ollama tags are never auto-listed here — register offerings under Providers."
      >
        <DataTable
          data={platform}
          columns={platformColumns}
          getRowId={(m) => m.modelRef}
          empty={
            <EmptyStatePanel
              icon={Shield}
              title="No platform models"
              description="In live mode, set OPENAI_API_KEY / ANTHROPIC_API_KEY and/or OLLAMA_BASE_URL (with models pulled), or add BYOK under Providers."
            />
          }
        />
      </AdminSection>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          title="Add allowlist rule"
          description="Pick a model ref and optional role scope."
          size="sm"
        >
          <div className="grid gap-3">
            <div>
              <Label htmlFor="al-ref">Model</Label>
              <Select
                id="al-ref"
                value={allowRef}
                onChange={(e) => setAllowRef(e.target.value)}
              >
                <option value="">Select model…</option>
                {catalogRefs.map((r) => (
                  <option key={r.modelRef} value={r.modelRef}>
                    {r.displayName} ({r.modelRef})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="al-role">Role scope</Label>
              <Select
                id="al-role"
                value={allowRole}
                onChange={(e) => setAllowRole(e.target.value)}
              >
                <option value="">All roles</option>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !allowRef}
              onClick={() => void addRule()}
            >
              {busy ? "Saving…" : "Add rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeId != null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove allowlist rule?"
        description={
          removeId
            ? `Stop restricting ${removeId.modelRef}${removeId.role ? ` for ${removeId.role}` : ""}.`
            : ""
        }
        confirmLabel="Remove"
        danger
        loading={busy}
        onConfirm={async () => {
          if (!removeId) return;
          setBusy(true);
          const r = await adminFetch("/api/admin/models", {
            method: "DELETE",
            body: JSON.stringify({
              action: "allowlist_delete",
              id: removeId.id,
            }),
          });
          setBusy(false);
          setRemoveId(null);
          if (!r.ok) setError(r.error);
          else await refresh();
        }}
      />
    </div>
  );
}
