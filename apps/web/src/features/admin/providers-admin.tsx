import { createColumnHelper } from "@tanstack/react-table";
import {
  Boxes,
  Cable,
  KeyRound,
  Pencil,
  Plus,
  PlugZap,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyStatePanel,
  Icon,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Tooltip,
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

export type ProviderModelCaps = {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  numCtx?: number;
};

export type ProviderModel = {
  id: string;
  modelRef: string;
  modelId: string;
  displayName: string;
  isEnabled: boolean;
  inputUsdPer1m: number | null;
  outputUsdPer1m: number | null;
  capabilities?: ProviderModelCaps | Record<string, unknown> | null;
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
        header: () => (
          <span className="sr-only">Actions</span>
        ),
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <ActionIconGroup label={`Actions for ${row.name}`}>
              <ActionIcon
                icon={Boxes}
                label={`Models for ${row.name}`}
                onClick={() => setSelectedId(row.id)}
              />
              <ActionIcon
                icon={Pencil}
                label={`Edit ${row.name}`}
                onClick={() => setEditConn(row)}
              />
              <ActionIcon
                icon={PlugZap}
                label={`Test connection ${row.name}`}
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
                      setInfo(
                        `Test OK for ${row.name} (${result.latencyMs} ms)`,
                      );
                    else setError(result?.message ?? "Test failed");
                  })()
                }
              />
              <ActionIcon
                icon={KeyRound}
                label={`Rotate API key for ${row.name}`}
                onClick={() => setRotateConn(row)}
              />
              <ActionIcon
                icon={Trash2}
                label={`Delete ${row.name}`}
                danger
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
              />
            </ActionIconGroup>
          );
        },
      }),
    ],
    [refresh, selectedId],
  );

  function modelColumnsFor(conn: ProviderConn) {
    return [
      modelHelper.accessor("displayName", { header: "Display" }),
      modelHelper.accessor("modelId", {
        header: "Model id",
        cell: (ctx) => (
          <code className="text-[12px] text-text-secondary">
            {ctx.getValue()}
          </code>
        ),
      }),
      modelHelper.display({
        id: "limits",
        header: "Limits",
        cell: (ctx) => {
          const caps = (ctx.row.original.capabilities ??
            {}) as ProviderModelCaps;
          const cw = caps.contextWindow;
          const mo = caps.maxOutputTokens;
          const nc = caps.numCtx;
          if (cw == null && mo == null && nc == null) {
            return <span className="text-text-faint">defaults</span>;
          }
          const bits: string[] = [];
          if (cw != null) bits.push(`ctx ${cw.toLocaleString()}`);
          if (nc != null && nc !== cw) bits.push(`num_ctx ${nc.toLocaleString()}`);
          if (mo != null) bits.push(`out ${mo.toLocaleString()}`);
          return (
            <span className="font-mono text-[11px] text-text-muted">
              {bits.join(" · ")}
            </span>
          );
        },
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
        header: () => <span className="sr-only">Actions</span>,
        cell: (ctx) => {
          const m = ctx.row.original;
          return (
            <ActionIconGroup label={`Actions for model ${m.displayName}`}>
              <ActionIcon
                icon={Pencil}
                label={`Edit model ${m.displayName}`}
                onClick={() => setEditModel({ conn, model: m })}
              />
              <ActionIcon
                icon={Trash2}
                label={`Remove model ${m.displayName}`}
                danger
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
              />
            </ActionIconGroup>
          );
        },
      }),
    ];
  }

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

      {/* Always show models for every connection — no hide-behind-select */}
      {rows.map((conn) => (
        <AdminSection
          key={conn.id}
          title={`Models · ${conn.name}`}
          description={`${conn.kind}${conn.baseUrl ? ` · ${conn.baseUrl}` : ""}${selectedId === conn.id ? " · selected" : ""}. Context / max output apply on chat.`}
          actions={
            <Button type="button" onClick={() => setModelParent(conn)}>
              <Icon icon={Plus} size="sm" />
              Add model
            </Button>
          }
        >
          <DataTable
            data={conn.models}
            columns={modelColumnsFor(conn)}
            getRowId={(m) => m.id}
            empty={
              <EmptyStatePanel
                icon={Plus}
                title="No models on this provider"
                description="Add offerings (Ollama: pick from discovered tags). Chat only lists enabled offerings."
                action={
                  <Button type="button" onClick={() => setModelParent(conn)}>
                    <Icon icon={Plus} size="sm" />
                    Add model
                  </Button>
                }
              />
            }
          />
        </AdminSection>
      ))}

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

/** Compact icon toolbar for table rows */
function ActionIconGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-0.5"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function ActionIcon({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={label} side="top">
      <IconButton
        icon={icon}
        label={label}
        iconSize="sm"
        disabled={disabled}
        onClick={onClick}
        className={[
          "h-8 w-8",
          danger
            ? "text-danger/80 hover:bg-danger/10 hover:text-danger"
            : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </Tooltip>
  );
}

/** Full Ollama tag — keep size/quant (gemma3:4b, not "4b"). */
function formatOllamaLabel(name: string): string {
  return name.trim();
}

function parseOptionalInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function capsFromForm(input: {
  contextWindow: string;
  maxOutput: string;
  numCtx: string;
  vision: boolean;
  tools: boolean;
  isOllama: boolean;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    streaming: true,
    vision: input.vision,
    tools: input.tools,
    imageGen: false,
  };
  const cw = parseOptionalInt(input.contextWindow);
  const mo = parseOptionalInt(input.maxOutput);
  const nc = parseOptionalInt(input.numCtx);
  if (cw != null) out.contextWindow = cw;
  if (mo != null) out.maxOutputTokens = mo;
  if (input.isOllama && nc != null) out.numCtx = nc;
  else if (input.isOllama && cw != null) out.numCtx = cw;
  return out;
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
    capabilities: Record<string, unknown>;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inputRate, setInputRate] = useState("");
  const [outputRate, setOutputRate] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [maxOutput, setMaxOutput] = useState("");
  const [numCtx, setNumCtx] = useState("");
  const [vision, setVision] = useState(false);
  const [tools, setTools] = useState(false);
  /** Ollama: discovered tags from /api/tags */
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [customMode, setCustomMode] = useState(false);

  const isOllama = conn?.kind === "ollama";
  const registered = useMemo(
    () => new Set((conn?.models ?? []).map((m) => m.modelId)),
    [conn],
  );

  useEffect(() => {
    if (!conn) return;
    setModelId("");
    setDisplayName("");
    setInputRate("");
    setOutputRate("");
    setContextWindow(isOllama ? "8192" : "");
    setMaxOutput(isOllama ? "2048" : "4096");
    setNumCtx("");
    setVision(false);
    setTools(false);
    setQuery("");
    setCustomMode(conn.kind !== "ollama");
    setTags([]);
    setTagsError(null);

    if (conn.kind !== "ollama") return;

    let cancelled = false;
    setTagsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/admin/providers", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_tags", id: conn.id }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          models?: string[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setTagsError(data.error ?? "Could not list Ollama models");
          setTags([]);
          setCustomMode(true);
          return;
        }
        const list = Array.isArray(data.models) ? data.models : [];
        setTags(list);
        if (list.length === 0) {
          setTagsError("No models on this Ollama host — pull one or enter an id");
          setCustomMode(true);
        }
      } catch {
        if (!cancelled) {
          setTagsError("Could not reach Ollama");
          setCustomMode(true);
        }
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conn]);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? tags.filter((t) => t.toLowerCase().includes(q))
      : tags;
    return list;
  }, [tags, query]);

  function pickTag(name: string) {
    setModelId(name);
    setDisplayName(formatOllamaLabel(name));
    setCustomMode(false);
    setQuery("");
  }

  return (
    <Dialog open={conn != null} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add model"
        description={
          conn
            ? isOllama
              ? `Pick a model from ${conn.name} (Ollama /api/tags), or enter a custom id. Rates optional.`
              : `Offering on ${conn.name}. Rates optional (USD per 1M tokens).`
            : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {isOllama && !customMode ? (
            <div className="sm:col-span-2 space-y-2">
              <Field label="Installed models">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tagsLoading
                      ? "Loading from Ollama…"
                      : "Search models… e.g. llama, qwen"
                  }
                  disabled={tagsLoading}
                  autoFocus
                />
              </Field>
              {tagsError ? (
                <p className="text-xs text-amber-500/90">{tagsError}</p>
              ) : null}
              <div
                className="max-h-48 overflow-y-auto rounded-md border border-border-subtle bg-bg-elevated"
                role="listbox"
                aria-label="Ollama models"
              >
                {tagsLoading ? (
                  <p className="px-3 py-4 text-sm text-text-muted">
                    Fetching /api/tags…
                  </p>
                ) : filteredTags.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-text-muted">
                    {tags.length === 0
                      ? "No models discovered."
                      : "No matches for that search."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {filteredTags.map((name) => {
                      const already = registered.has(name);
                      const selected = modelId === name;
                      return (
                        <li key={name}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={already}
                            onClick={() => pickTag(name)}
                            className={[
                              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                              already
                                ? "cursor-not-allowed opacity-40"
                                : "hover:bg-bg-hover",
                              selected
                                ? "bg-accent/15 text-text-primary"
                                : "text-text-secondary",
                            ].join(" ")}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-sm font-medium text-text-primary">
                                {name}
                              </span>
                            </span>
                            {already ? (
                              <Badge className="shrink-0 text-[10px]">added</Badge>
                            ) : selected ? (
                              <Badge className="shrink-0 text-[10px]">selected</Badge>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                onClick={() => {
                  setCustomMode(true);
                  setModelId("");
                  setDisplayName("");
                }}
              >
                Enter a custom model id…
              </button>
            </div>
          ) : (
            <>
              <Field label="Model id">
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder={isOllama ? "llama3.2:latest" : "gpt-4.1"}
                  autoFocus
                />
              </Field>
              {isOllama ? (
                <div className="sm:col-span-2 -mt-1">
                  <button
                    type="button"
                    className="text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                    onClick={() => {
                      setCustomMode(false);
                      setModelId("");
                      setDisplayName("");
                    }}
                    disabled={tagsLoading || tags.length === 0}
                  >
                    ← Back to discovered models
                  </button>
                </div>
              ) : null}
            </>
          )}
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={isOllama ? "Llama 3.2" : "GPT-4.1 (prod)"}
            />
          </Field>
          <Field label="Context window (tokens)">
            <Input
              value={contextWindow}
              onChange={(e) => setContextWindow(e.target.value)}
              placeholder={isOllama ? "8192" : "e.g. 128000"}
              inputMode="numeric"
            />
          </Field>
          <Field label="Max output tokens">
            <Input
              value={maxOutput}
              onChange={(e) => setMaxOutput(e.target.value)}
              placeholder="e.g. 4096"
              inputMode="numeric"
            />
          </Field>
          {isOllama ? (
            <Field label="Ollama num_ctx (optional)">
              <Input
                value={numCtx}
                onChange={(e) => setNumCtx(e.target.value)}
                placeholder="defaults to context window"
                inputMode="numeric"
              />
            </Field>
          ) : null}
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
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={vision}
                onChange={(e) => setVision(e.target.checked)}
              />
              Vision
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={tools}
                onChange={(e) => setTools(e.target.checked)}
              />
              Tools
            </label>
          </div>
        </div>
        {isOllama && modelId && !customMode ? (
          <p className="text-xs text-text-muted">
            Selected:{" "}
            <span className="font-mono text-text-secondary">{modelId}</span>
          </p>
        ) : null}
        <p className="text-[11px] text-text-faint">
          Context window is the model’s max input budget. Max output caps the
          completion. For Ollama, context is sent as{" "}
          <code className="font-mono">num_ctx</code> (slow first load if large).
        </p>
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
                capabilities: capsFromForm({
                  contextWindow,
                  maxOutput,
                  numCtx,
                  vision,
                  tools,
                  isOllama: Boolean(isOllama),
                }),
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
    capabilities: Record<string, unknown>;
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [inputRate, setInputRate] = useState("");
  const [outputRate, setOutputRate] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [maxOutput, setMaxOutput] = useState("");
  const [numCtx, setNumCtx] = useState("");
  const [vision, setVision] = useState(false);
  const [tools, setTools] = useState(false);

  const isOllama = state?.conn.kind === "ollama";

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
      const caps = (state.model.capabilities ?? {}) as ProviderModelCaps;
      setContextWindow(
        caps.contextWindow != null ? String(caps.contextWindow) : "",
      );
      setMaxOutput(
        caps.maxOutputTokens != null ? String(caps.maxOutputTokens) : "",
      );
      setNumCtx(caps.numCtx != null ? String(caps.numCtx) : "");
      setVision(caps.vision === true);
      setTools(caps.tools === true);
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
          <Field label="Context window (tokens)">
            <Input
              value={contextWindow}
              onChange={(e) => setContextWindow(e.target.value)}
              placeholder="e.g. 8192"
              inputMode="numeric"
            />
          </Field>
          <Field label="Max output tokens">
            <Input
              value={maxOutput}
              onChange={(e) => setMaxOutput(e.target.value)}
              placeholder="e.g. 4096"
              inputMode="numeric"
            />
          </Field>
          {isOllama ? (
            <Field label="Ollama num_ctx (optional)">
              <Input
                value={numCtx}
                onChange={(e) => setNumCtx(e.target.value)}
                placeholder="defaults to context window"
                inputMode="numeric"
              />
            </Field>
          ) : null}
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
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={vision}
                onChange={(e) => setVision(e.target.checked)}
              />
              Vision
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={tools}
                onChange={(e) => setTools(e.target.checked)}
              />
              Tools
            </label>
          </div>
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
                capabilities: capsFromForm({
                  contextWindow,
                  maxOutput,
                  numCtx,
                  vision,
                  tools,
                  isOllama: Boolean(isOllama),
                }),
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
