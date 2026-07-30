import { createColumnHelper } from "@tanstack/react-table";
import { Cable, Pencil, Plus, PlugZap, Trash2 } from "lucide-react";
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
  Input,
  Label,
  Select,
  Switch,
} from "#/components/ui";
import { AdminAlert } from "./admin-alert";
import { AdminSection } from "./admin-section";
import { ConfirmDialog } from "./confirm-dialog";
import { AdminPageHeader } from "./page-header";

const KINDS = [
  "openai",
  "anthropic",
  "openai_compatible",
  "ollama",
] as const;

export type ProviderModel = {
  id: string;
  modelRef: string;
  modelId: string;
  displayName: string;
  isEnabled: boolean;
  inputUsdPer1m: number | null;
  outputUsdPer1m: number | null;
};

export type ProviderConn = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string | null;
  isEnabled: boolean;
  hasCredentials: boolean;
  modelCount: number;
  models: ProviderModel[];
};

const connHelper = createColumnHelper<ProviderConn>();
const modelHelper = createColumnHelper<ProviderModel>();

type ConfirmState =
  | null
  | {
      title: string;
      description: string;
      confirmLabel: string;
      danger?: boolean;
      run: () => Promise<void>;
    };

export function ProvidersAdmin() {
  const [rows, setRows] = useState<ProviderConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editConn, setEditConn] = useState<ProviderConn | null>(null);
  const [rotateConn, setRotateConn] = useState<ProviderConn | null>(null);
  const [modelParent, setModelParent] = useState<ProviderConn | null>(null);
  const [editModel, setEditModel] = useState<{
    conn: ProviderConn;
    model: ProviderModel;
  } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/providers", {
      credentials: "same-origin",
    });
    if (!res.ok) {
      setError("Failed to load providers");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { connections: ProviderConn[] };
    setRows(
      (data.connections ?? []).map((c) => ({
        ...c,
        models: c.models ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function apiJson(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; error?: string; data?: unknown }> {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      result?: { ok?: boolean; message?: string; latencyMs?: number };
    };
    if (!res.ok) return { ok: false, error: data.error ?? "Request failed" };
    return { ok: true, data };
  }

  function askConfirm(c: NonNullable<ConfirmState>) {
    setConfirm(c);
  }

  const connColumns = useMemo(
    () => [
      connHelper.accessor("name", {
        header: "Name",
        cell: (ctx) => (
          <button
            type="button"
            className="text-left font-medium text-text-primary hover:underline"
            onClick={() => setSelectedId(ctx.row.original.id)}
          >
            {ctx.getValue()}
          </button>
        ),
      }),
      connHelper.accessor("kind", {
        header: "Kind",
        cell: (ctx) => (
          <Badge className="font-mono text-[11px]">{ctx.getValue()}</Badge>
        ),
      }),
      connHelper.accessor("baseUrl", {
        header: "Base URL",
        enableSorting: false,
        cell: (ctx) => {
          const v = ctx.getValue();
          return v ? (
            <span className="block max-w-[12rem] truncate text-text-muted" title={v}>
              {v}
            </span>
          ) : (
            <span className="text-text-faint">—</span>
          );
        },
      }),
      connHelper.accessor("modelCount", {
        header: "Models",
        cell: (ctx) => ctx.getValue(),
      }),
      connHelper.accessor("hasCredentials", {
        header: "Secrets",
        enableSorting: false,
        cell: (ctx) =>
          ctx.getValue() ? (
            <span className="text-text-muted">•••• set</span>
          ) : (
            <span className="text-text-faint">empty</span>
          ),
      }),
      connHelper.accessor("isEnabled", {
        header: "Enabled",
        enableSorting: false,
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <Switch
              checked={row.isEnabled}
              aria-label={`${row.name} enabled`}
              onCheckedChange={(next) => {
                if (next === row.isEnabled) return;
                if (!next) {
                  askConfirm({
                    title: "Disable provider?",
                    description: `Models on “${row.name}” will stop resolving until re-enabled.`,
                    confirmLabel: "Disable",
                    danger: true,
                    run: async () => {
                      setBusy(true);
                      const r = await apiJson("/api/admin/providers", {
                        method: "PATCH",
                        body: JSON.stringify({ id: row.id, isEnabled: false }),
                      });
                      setBusy(false);
                      setConfirm(null);
                      if (!r.ok) setError(r.error ?? "Failed");
                      else {
                        setInfo(`Disabled ${row.name}`);
                        await refresh();
                      }
                    },
                  });
                  return;
                }
                void (async () => {
                  const r = await apiJson("/api/admin/providers", {
                    method: "PATCH",
                    body: JSON.stringify({ id: row.id, isEnabled: true }),
                  });
                  if (!r.ok) setError(r.error ?? "Failed");
                  else await refresh();
                })();
              }}
            />
          );
        },
      }),
      connHelper.display({
        id: "actions",
        header: "",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedId(row.id)}
              >
                Models
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditConn(row)}
              >
                <Icon icon={Pencil} size="sm" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void (async () => {
                    setError(null);
                    setInfo(null);
                    const r = await apiJson("/api/admin/providers", {
                      method: "POST",
                      body: JSON.stringify({ action: "test", id: row.id }),
                    });
                    const result = (
                      r.data as {
                        result?: {
                          ok?: boolean;
                          latencyMs?: number;
                          message?: string;
                        };
                      }
                    )?.result;
                    if (!r.ok) setError(r.error ?? "Test failed");
                    else if (result?.ok)
                      setInfo(`Test OK for ${row.name} (${result.latencyMs} ms)`);
                    else setError(result?.message ?? "Test failed");
                  })()
                }
              >
                <Icon icon={PlugZap} size="sm" />
                Test
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRotateConn(row)}
              >
                Rotate key
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  askConfirm({
                    title: "Delete provider?",
                    description:
                      row.modelCount > 0
                        ? `“${row.name}” still has ${row.modelCount} model(s). Remove models first, or disable instead.`
                        : `Permanently delete “${row.name}”. This cannot be undone.`,
                    confirmLabel: "Delete",
                    danger: true,
                    run: async () => {
                      if (row.modelCount > 0) {
                        setConfirm(null);
                        setError(
                          "Remove models before deleting this connection.",
                        );
                        return;
                      }
                      setBusy(true);
                      const r = await apiJson("/api/admin/providers", {
                        method: "DELETE",
                        body: JSON.stringify({ id: row.id }),
                      });
                      setBusy(false);
                      setConfirm(null);
                      if (!r.ok) setError(r.error ?? "Delete failed");
                      else {
                        if (selectedId === row.id) setSelectedId(null);
                        await refresh();
                      }
                    },
                  })
                }
              >
                <Icon icon={Trash2} size="sm" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [refresh, selectedId],
  );

  const modelColumns = useMemo(
    () => [
      modelHelper.accessor("displayName", { header: "Display" }),
      modelHelper.accessor("modelId", {
        header: "Model id",
        cell: (ctx) => (
          <code className="text-[12px] text-text-secondary">{ctx.getValue()}</code>
        ),
      }),
      modelHelper.accessor("inputUsdPer1m", {
        header: "In $/1M",
        cell: (ctx) =>
          ctx.getValue() == null ? (
            <span className="text-text-faint">default</span>
          ) : (
            String(ctx.getValue())
          ),
      }),
      modelHelper.accessor("outputUsdPer1m", {
        header: "Out $/1M",
        cell: (ctx) =>
          ctx.getValue() == null ? (
            <span className="text-text-faint">default</span>
          ) : (
            String(ctx.getValue())
          ),
      }),
      modelHelper.accessor("isEnabled", {
        header: "Enabled",
        enableSorting: false,
        cell: (ctx) => {
          const m = ctx.row.original;
          return (
            <Switch
              checked={m.isEnabled}
              aria-label={`${m.displayName} enabled`}
              onCheckedChange={(next) => {
                if (next === m.isEnabled) return;
                if (!next) {
                  askConfirm({
                    title: "Disable model?",
                    description: `“${m.displayName}” will be hidden from the chat picker.`,
                    confirmLabel: "Disable",
                    danger: true,
                    run: async () => {
                      setBusy(true);
                      const r = await apiJson("/api/admin/models", {
                        method: "PATCH",
                        body: JSON.stringify({ id: m.id, isEnabled: false }),
                      });
                      setBusy(false);
                      setConfirm(null);
                      if (!r.ok) setError(r.error ?? "Failed");
                      else await refresh();
                    },
                  });
                  return;
                }
                void (async () => {
                  const r = await apiJson("/api/admin/models", {
                    method: "PATCH",
                    body: JSON.stringify({ id: m.id, isEnabled: true }),
                  });
                  if (!r.ok) setError(r.error ?? "Failed");
                  else await refresh();
                })();
              }}
            />
          );
        },
      }),
      modelHelper.display({
        id: "actions",
        header: "",
        cell: (ctx) => {
          const m = ctx.row.original;
          const conn = selected;
          if (!conn) return null;
          return (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditModel({ conn, model: m })}
              >
                <Icon icon={Pencil} size="sm" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  askConfirm({
                    title: "Remove model?",
                    description: `Remove “${m.displayName}” from ${conn.name}. Historical chats keep their model ref.`,
                    confirmLabel: "Remove",
                    danger: true,
                    run: async () => {
                      setBusy(true);
                      const r = await apiJson("/api/admin/models", {
                        method: "DELETE",
                        body: JSON.stringify({ id: m.id }),
                      });
                      setBusy(false);
                      setConfirm(null);
                      if (!r.ok) setError(r.error ?? "Failed");
                      else await refresh();
                    },
                  })
                }
              >
                <Icon icon={Trash2} size="sm" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [refresh, selected],
  );

  return (
    <div>
      <AdminPageHeader
        title="Providers"
        description="Connections hold credentials. Models are offerings on a connection—with their own enable state and pricing."
        actions={
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Add provider
          </Button>
        }
      />

      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {info ? <AdminAlert tone="success">{info}</AdminAlert> : null}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <DataTable
          data={rows}
          columns={connColumns}
          getRowId={(r) => r.id}
          empty={
            <EmptyStatePanel
              icon={Cable}
              title="No providers yet"
              description="Add a BYOK or compatible endpoint. Platform env models still work without a connection."
              action={
                <Button type="button" onClick={() => setAddOpen(true)}>
                  <Icon icon={Plus} size="sm" />
                  Add provider
                </Button>
              }
            />
          }
        />
      )}

      {selected ? (
        <AdminSection
          title={`Models · ${selected.name}`}
          description={`${selected.kind}${selected.baseUrl ? ` · ${selected.baseUrl}` : ""}. Same model id on another provider is a separate offering.`}
          actions={
            <Button type="button" onClick={() => setModelParent(selected)}>
              <Icon icon={Plus} size="sm" />
              Add model
            </Button>
          }
        >
          <DataTable
            data={selected.models}
            columns={modelColumns}
            getRowId={(m) => m.id}
            empty={
              <EmptyStatePanel
                icon={Plus}
                title="No models on this provider"
                description="Add the model ids your key can call, with optional per-offering rates."
                action={
                  <Button
                    type="button"
                    onClick={() => setModelParent(selected)}
                  >
                    <Icon icon={Plus} size="sm" />
                    Add model
                  </Button>
                }
              />
            }
          />
        </AdminSection>
      ) : rows.length > 0 ? (
        <p className="mt-6 text-sm text-text-faint">
          Select a provider name to manage its models and pricing.
        </p>
      ) : null}

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        busy={busy}
        onSubmit={async (body) => {
          setBusy(true);
          setError(null);
          const r = await apiJson("/api/admin/providers", {
            method: "POST",
            body: JSON.stringify(body),
          });
          setBusy(false);
          if (!r.ok) {
            setError(r.error ?? "Create failed");
            return false;
          }
          setInfo("Provider created. Secrets are not shown again.");
          setAddOpen(false);
          await refresh();
          return true;
        }}
      />

      <EditProviderDialog
        conn={editConn}
        onOpenChange={(o) => !o && setEditConn(null)}
        busy={busy}
        onSubmit={async (body) => {
          if (!editConn) return false;
          setBusy(true);
          const r = await apiJson("/api/admin/providers", {
            method: "PATCH",
            body: JSON.stringify({ id: editConn.id, ...body }),
          });
          setBusy(false);
          if (!r.ok) {
            setError(r.error ?? "Update failed");
            return false;
          }
          setEditConn(null);
          await refresh();
          return true;
        }}
      />

      <RotateKeyDialog
        conn={rotateConn}
        onOpenChange={(o) => !o && setRotateConn(null)}
        busy={busy}
        onSubmit={async (apiKey) => {
          if (!rotateConn) return false;
          setBusy(true);
          const r = await apiJson("/api/admin/providers", {
            method: "POST",
            body: JSON.stringify({
              action: "rotate",
              id: rotateConn.id,
              apiKey,
            }),
          });
          setBusy(false);
          if (!r.ok) {
            setError(r.error ?? "Rotate failed");
            return false;
          }
          setRotateConn(null);
          setInfo("API key rotated.");
          await refresh();
          return true;
        }}
      />

      <AddModelDialog
        conn={modelParent}
        onOpenChange={(o) => !o && setModelParent(null)}
        busy={busy}
        onSubmit={async (body) => {
          if (!modelParent) return false;
          setBusy(true);
          const r = await apiJson("/api/admin/models", {
            method: "POST",
            body: JSON.stringify({
              action: "create",
              providerKind: modelParent.kind,
              connectionId: modelParent.id,
              ...body,
            }),
          });
          setBusy(false);
          if (!r.ok) {
            setError(r.error ?? "Create model failed");
            return false;
          }
          setModelParent(null);
          setSelectedId(modelParent.id);
          await refresh();
          return true;
        }}
      />

      <EditModelDialog
        state={editModel}
        onOpenChange={(o) => !o && setEditModel(null)}
        busy={busy}
        onSubmit={async (body) => {
          if (!editModel) return false;
          setBusy(true);
          const r = await apiJson("/api/admin/models", {
            method: "PATCH",
            body: JSON.stringify({ id: editModel.model.id, ...body }),
          });
          setBusy(false);
          if (!r.ok) {
            setError(r.error ?? "Update failed");
            return false;
          }
          setEditModel(null);
          await refresh();
          return true;
        }}
      />

      <ConfirmDialog
        open={confirm != null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        loading={busy}
        onConfirm={async () => {
          if (confirm) await confirm.run();
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AddProviderDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("openai");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (open) {
      setKind("openai");
      setName("");
      setBaseUrl("");
      setApiKey("");
    }
  }, [open]);

  const needsBase = kind === "openai_compatible" || kind === "ollama";
  const needsKey = kind !== "ollama";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add provider"
        description="Credentials are encrypted at rest and never shown again after save."
        size="md"
      >
        <div className="grid gap-3">
          <Field label="Kind">
            <Select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as (typeof KINDS)[number])
              }
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production OpenAI"
            />
          </Field>
          <Field label={needsBase ? "Base URL (required)" : "Base URL"}>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={
                kind === "ollama"
                  ? "http://127.0.0.1:11434"
                  : "https://api.openai.com/v1"
              }
            />
          </Field>
          <Field label={needsKey ? "API key" : "API key (optional)"}>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder="••••••••"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({
                kind,
                name: name || `${kind} connection`,
                baseUrl: baseUrl || undefined,
                apiKey: apiKey || "",
              })
            }
          >
            {busy ? "Saving…" : "Create provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProviderDialog({
  conn,
  onOpenChange,
  onSubmit,
  busy,
}: {
  conn: ProviderConn | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (body: {
    name: string;
    baseUrl: string | null;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (conn) {
      setName(conn.name);
      setBaseUrl(conn.baseUrl ?? "");
    }
  }, [conn]);

  return (
    <Dialog open={conn != null} onOpenChange={onOpenChange}>
      <DialogContent
        title="Edit provider"
        description={conn ? `${conn.kind} · kind cannot be changed` : undefined}
      >
        <div className="grid gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Base URL">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({ name, baseUrl: baseUrl || null })
            }
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RotateKeyDialog({
  conn,
  onOpenChange,
  onSubmit,
  busy,
}: {
  conn: ProviderConn | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (apiKey: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  useEffect(() => {
    if (conn) setApiKey("");
  }, [conn]);

  return (
    <Dialog open={conn != null} onOpenChange={onOpenChange}>
      <DialogContent
        title="Rotate API key"
        description={
          conn
            ? `Replace the secret for “${conn.name}”. The previous key is discarded.`
            : undefined
        }
        size="sm"
      >
        <Field label="New API key">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !apiKey}
            onClick={() => void onSubmit(apiKey)}
          >
            {busy ? "Saving…" : "Rotate key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddModelDialog({
  conn,
  onOpenChange,
  onSubmit,
  busy,
}: {
  conn: ProviderConn | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (body: {
    modelId: string;
    displayName: string;
    inputUsdPer1m: number | null;
    outputUsdPer1m: number | null;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inputRate, setInputRate] = useState("");
  const [outputRate, setOutputRate] = useState("");

  useEffect(() => {
    if (conn) {
      setModelId("");
      setDisplayName("");
      setInputRate("");
      setOutputRate("");
    }
  }, [conn]);

  return (
    <Dialog open={conn != null} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add model"
        description={
          conn
            ? `Offering on ${conn.name}. Rates optional (USD per 1M tokens).`
            : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Model id">
            <Input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="gpt-4.1"
            />
          </Field>
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="GPT-4.1 (prod)"
            />
          </Field>
          <Field label="Input $/1M">
            <Input
              value={inputRate}
              onChange={(e) => setInputRate(e.target.value)}
              placeholder="optional"
            />
          </Field>
          <Field label="Output $/1M">
            <Input
              value={outputRate}
              onChange={(e) => setOutputRate(e.target.value)}
              placeholder="optional"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !modelId.trim()}
            onClick={() =>
              void onSubmit({
                modelId: modelId.trim(),
                displayName: displayName.trim() || modelId.trim(),
                inputUsdPer1m: inputRate === "" ? null : Number(inputRate),
                outputUsdPer1m: outputRate === "" ? null : Number(outputRate),
              })
            }
          >
            {busy ? "Saving…" : "Add model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditModelDialog({
  state,
  onOpenChange,
  onSubmit,
  busy,
}: {
  state: { conn: ProviderConn; model: ProviderModel } | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (body: {
    displayName: string;
    inputUsdPer1m: number | null;
    outputUsdPer1m: number | null;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [inputRate, setInputRate] = useState("");
  const [outputRate, setOutputRate] = useState("");

  useEffect(() => {
    if (state) {
      setDisplayName(state.model.displayName);
      setInputRate(
        state.model.inputUsdPer1m == null
          ? ""
          : String(state.model.inputUsdPer1m),
      );
      setOutputRate(
        state.model.outputUsdPer1m == null
          ? ""
          : String(state.model.outputUsdPer1m),
      );
    }
  }, [state]);

  return (
    <Dialog open={state != null} onOpenChange={onOpenChange}>
      <DialogContent
        title="Edit model"
        description={
          state ? (
            <code className="text-xs">{state.model.modelRef}</code>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <div />
          <Field label="Input $/1M">
            <Input
              value={inputRate}
              onChange={(e) => setInputRate(e.target.value)}
              placeholder="blank = pattern default"
            />
          </Field>
          <Field label="Output $/1M">
            <Input
              value={outputRate}
              onChange={(e) => setOutputRate(e.target.value)}
              placeholder="blank = pattern default"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({
                displayName,
                inputUsdPer1m: inputRate === "" ? null : Number(inputRate),
                outputUsdPer1m: outputRate === "" ? null : Number(outputRate),
              })
            }
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
