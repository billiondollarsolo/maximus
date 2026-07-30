import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import type { OverviewSnapshot } from "@maximus/domain";
import { overallLabel } from "@maximus/domain";
import { AdminAlert } from "#/features/admin/admin-alert";
import { AdminSection } from "#/features/admin/admin-section";
import { AdminStatCard } from "#/features/admin/admin-stat-card";
import { AdminPageHeader } from "#/features/admin/page-header";
import {
  LiveIndicator,
  StatusPill,
} from "#/features/admin/status-pill";
import { useEventSource } from "#/features/live/use-event-source";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Select,
  Switch,
} from "#/components/ui";

const INTERVAL_OPTIONS = [5, 15, 30, 60, 360, 1440] as const;

function formatLatency(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1) return "<1ms";
  return `${Math.round(ms)}ms`;
}

function formatCost(micros: number | null | undefined) {
  if (micros == null) return "—";
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function OverviewDashboard() {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [probeOpen, setProbeOpen] = useState(false);
  const [probeEnabled, setProbeEnabled] = useState(false);
  const [probeInterval, setProbeInterval] = useState(15);
  const [probeSaving, setProbeSaving] = useState(false);
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeMsg, setProbeMsg] = useState<string | null>(null);

  const applySnapshot = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") return;
    const s = data as OverviewSnapshot;
    if (!s.components || !s.connectivity || !s.overall) return;
    setSnapshot(s);
    setParseError(null);
    setProbeEnabled(s.probes?.enabled ?? false);
    setProbeInterval(s.probes?.intervalMinutes ?? 15);
  }, []);

  const onEvent = useCallback(
    (event: string, data: string) => {
      if (event !== "snapshot") return;
      try {
        applySnapshot(JSON.parse(data) as unknown);
      } catch {
        setParseError("Invalid snapshot payload");
      }
    },
    [applySnapshot],
  );

  const { status: liveStatus } = useEventSource(
    "/api/admin/overview/stream",
    {
      enabled: true,
      events: ["snapshot"],
      onEvent,
      pollUrl: "/api/admin/overview",
      pollIntervalMs: 10_000,
      onPollJson: applySnapshot,
    },
  );

  const refreshNow = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", {
        credentials: "same-origin",
      });
      if (res.ok) applySnapshot(await res.json());
    } catch {
      /* ignore */
    }
  }, [applySnapshot]);

  const saveProbeSettings = useCallback(async () => {
    setProbeSaving(true);
    setProbeMsg(null);
    try {
      const res = await fetch("/api/admin/overview/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerProbeEnabled: probeEnabled,
          providerProbeIntervalMinutes: probeInterval,
        }),
      });
      const body = (await res.json()) as {
        settings?: { providerProbeEnabled: boolean; providerProbeIntervalMinutes: number };
        error?: string;
      };
      if (!res.ok) {
        setProbeMsg(body.error ?? "Failed to save");
        return;
      }
      if (body.settings) {
        setProbeEnabled(body.settings.providerProbeEnabled);
        setProbeInterval(body.settings.providerProbeIntervalMinutes);
      }
      setProbeMsg("Saved");
      setProbeOpen(false);
      await refreshNow();
    } finally {
      setProbeSaving(false);
    }
  }, [probeEnabled, probeInterval, refreshNow]);

  const probeNow = useCallback(async () => {
    setProbeRunning(true);
    setProbeMsg(null);
    try {
      const res = await fetch("/api/admin/overview/probe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json()) as {
        snapshot?: OverviewSnapshot;
        ran?: number;
        error?: string;
      };
      if (!res.ok) {
        setProbeMsg(body.error ?? "Probe failed");
        return;
      }
      if (body.snapshot) applySnapshot(body.snapshot);
      setProbeMsg(`Probed ${body.ran ?? 0} connection(s)`);
    } finally {
      setProbeRunning(false);
    }
  }, [applySnapshot]);

  const subtitle = useMemo(() => {
    if (!snapshot) return "Loading control plane…";
    const bits = [
      "Single-tenant workspace",
      snapshot.version ? `v${snapshot.version}` : null,
      snapshot.gitSha ? snapshot.gitSha.slice(0, 7) : null,
      `status: ${overallLabel(snapshot.overall)}`,
    ].filter(Boolean);
    return bits.join(" · ");
  }, [snapshot]);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator status={liveStatus} />
            <Button type="button" variant="secondary" onClick={() => void refreshNow()}>
              Refresh now
            </Button>
            <Button type="button" variant="secondary" onClick={() => setProbeOpen(true)}>
              Configure probes
            </Button>
            <Link
              to="/admin/providers"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-btn-primary px-3.5 text-sm font-medium text-btn-primary-fg transition-colors hover:bg-btn-primary-hover"
            >
              Manage providers
            </Link>
          </div>
        }
      />

      {parseError ? <AdminAlert tone="error">{parseError}</AdminAlert> : null}
      {probeMsg ? <AdminAlert tone="info">{probeMsg}</AdminAlert> : null}

      {snapshot?.connectivity.demoMode ? (
        <AdminAlert tone="info">
          <strong>Demo mode</strong> — {snapshot.connectivity.demoReasons.join("; ")}.
          Chat may use the fake provider. Configure platform keys or a BYOK connection
          and set <code className="text-xs">PROVIDER_MODE=live</code>.{" "}
          <Link to="/admin/providers" className="underline underline-offset-2">
            Providers
          </Link>
        </AdminAlert>
      ) : null}

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <p className="admin-stat-label">Overall</p>
          <div className="mt-2">
            <StatusPill status={snapshot?.overall ?? "unknown"} />
          </div>
          <p className="admin-stat-hint">
            {snapshot
              ? new Date(snapshot.generatedAt).toLocaleTimeString()
              : "Waiting for snapshot…"}
          </p>
        </div>
        {(snapshot?.components ?? []).map((c) => (
          <div key={c.id} className="admin-stat-card">
            <p className="admin-stat-label">{c.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={c.status} label={c.status} />
              <span className="text-sm text-text-muted">
                {formatLatency(c.latencyMs)}
              </span>
            </div>
            {c.detail ? (
              <p className="admin-stat-hint truncate" title={c.detail}>
                {c.detail}
              </p>
            ) : (
              <p className="admin-stat-hint">Checked</p>
            )}
          </div>
        ))}
        {!snapshot ? (
          <>
            <AdminStatCard label="Postgres" value="…" />
            <AdminStatCard label="Valkey" value="…" />
            <AdminStatCard label="Object store" value="…" />
          </>
        ) : null}
      </div>

      <AdminSection
        title="Connectivity"
        description="Provider path and credential posture (no secrets)."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={probeRunning}
            onClick={() => void probeNow()}
          >
            {probeRunning ? "Probing…" : "Probe all now"}
          </Button>
        }
      >
        {snapshot ? (
          <dl className="connectivity-dl">
            <div>
              <dt>Mode</dt>
              <dd>{snapshot.connectivity.providerMode}</dd>
            </div>
            <div>
              <dt>ENCRYPTION_KEY</dt>
              <dd>
                {snapshot.connectivity.encryptionKeyConfigured ? "set" : "missing"}
              </dd>
            </div>
            <div>
              <dt>Platform OpenAI</dt>
              <dd>{snapshot.connectivity.platform.openai ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt>Platform Anthropic</dt>
              <dd>{snapshot.connectivity.platform.anthropic ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt>Ollama base URL</dt>
              <dd>
                {snapshot.connectivity.platform.ollamaBaseUrl ? "yes" : "no"}
              </dd>
            </div>
            <div>
              <dt>BYOK</dt>
              <dd>
                {snapshot.connectivity.byok.enabled} enabled /{" "}
                {snapshot.connectivity.byok.disabled} disabled
              </dd>
            </div>
            <div>
              <dt>Allowlist</dt>
              <dd>
                {snapshot.connectivity.allowlistRuleCount === 0
                  ? "open (0 rules)"
                  : `${snapshot.connectivity.allowlistRuleCount} rules`}
              </dd>
            </div>
            <div>
              <dt>Provider probes</dt>
              <dd>
                {snapshot.probes.enabled
                  ? `Every ${snapshot.probes.intervalMinutes ?? "?"}m`
                  : "Off"}
                {snapshot.probes.lastRunAt
                  ? ` · Last ${new Date(snapshot.probes.lastRunAt).toLocaleString()}`
                  : ""}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-text-muted">Loading connectivity…</p>
        )}

        {snapshot?.probes.results && snapshot.probes.results.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {snapshot.probes.results.map((r) => (
              <li
                key={r.connectionId}
                className="flex flex-wrap items-center gap-2 text-text-secondary"
              >
                <span className="font-medium text-text-primary">{r.name}</span>
                <span className="text-text-faint">({r.kind})</span>
                {r.ok === null ? (
                  <StatusPill status="unknown" label="never" />
                ) : r.ok ? (
                  <StatusPill status="ok" label={`ok ${formatLatency(r.latencyMs)}`} />
                ) : (
                  <StatusPill
                    status="error"
                    label={r.errorCode ?? "failed"}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </AdminSection>

      <AdminSection title="Needs attention">
        {snapshot && snapshot.attention.length === 0 ? (
          <p className="rounded-xl border border-border-subtle bg-bg-sidebar px-4 py-3 text-sm text-text-muted">
            All clear
          </p>
        ) : (
          <ul className="space-y-2">
            {(snapshot?.attention ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-2 rounded-xl border border-border-subtle bg-bg-sidebar px-4 py-3 text-sm"
              >
                <StatusPill
                  status={
                    item.severity === "critical"
                      ? "error"
                      : item.severity === "warn"
                        ? "degraded"
                        : "ok"
                  }
                  label={item.severity}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-text-muted">{item.detail}</p>
                  ) : null}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="mt-1 inline-block text-xs text-accent underline-offset-2 hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      {snapshot?.usage7d ? (
        <AdminSection
          title="Usage (7d)"
          description="Org-scoped aggregates from usage events."
        >
          <div className="admin-stat-grid">
            <AdminStatCard label="Turns" value={String(snapshot.usage7d.turns)} />
            <AdminStatCard
              label="Tokens in"
              value={formatTokens(snapshot.usage7d.inputTokens)}
            />
            <AdminStatCard
              label="Tokens out"
              value={formatTokens(snapshot.usage7d.outputTokens)}
            />
            <AdminStatCard
              label="Est. cost"
              value={formatCost(snapshot.usage7d.costMicros)}
            />
            <AdminStatCard
              label="Errors"
              value={String(snapshot.usage7d.errorTurns)}
            />
          </div>
        </AdminSection>
      ) : null}

      <Dialog open={probeOpen} onOpenChange={setProbeOpen}>
        <DialogContent
          title="Provider probes"
          description="Optional cheap connectivity checks (models/tags list). Off by default. Runs while the overview live stream is open, or via Probe all now."
          size="sm"
        >
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text-primary">Enable automatic probes</span>
              <Switch
                checked={probeEnabled}
                onCheckedChange={setProbeEnabled}
                aria-label="Enable automatic probes"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-text-muted">Interval</span>
              <Select
                value={String(probeInterval)}
                disabled={!probeEnabled}
                onChange={(e) => setProbeInterval(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Every {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProbeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={probeSaving}
              onClick={() => void saveProbeSettings()}
            >
              {probeSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
