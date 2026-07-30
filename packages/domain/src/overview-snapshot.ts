/**
 * Pure overview snapshot types + derivation helpers.
 * No I/O — unit-test first; builders assemble these fields.
 */

export type ComponentStatus = "ok" | "degraded" | "error" | "unknown";

export type HealthComponentId = "app" | "postgres" | "valkey" | "storage" | string;

export type HealthComponent = {
  id: HealthComponentId;
  label: string;
  status: ComponentStatus;
  latencyMs?: number | null;
  detail?: string | null;
  checkedAt: string;
};

export type ConnectivitySnapshot = {
  providerMode: "fake" | "live";
  encryptionKeyConfigured: boolean;
  platform: {
    openai: boolean;
    anthropic: boolean;
    ollamaBaseUrl: boolean;
  };
  byok: {
    total: number;
    enabled: number;
    disabled: number;
  };
  allowlistRuleCount: number;
  /** true when live LLM use is unlikely to work */
  demoMode: boolean;
  demoReasons: string[];
};

export type ProviderProbeResultRow = {
  connectionId: string;
  name: string;
  kind: string;
  ok: boolean | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  checkedAt?: string | null;
};

export type ProviderProbeSummary = {
  enabled: boolean;
  intervalMinutes: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  results: ProviderProbeResultRow[];
};

export type AttentionItem = {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail?: string;
  href?: string;
};

export type Usage7dStrip = {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number | null;
  errorTurns: number;
};

export type OverviewSnapshot = {
  version: string | null;
  gitSha: string | null;
  environment: string | null;
  overall: ComponentStatus;
  components: HealthComponent[];
  connectivity: ConnectivitySnapshot;
  probes: ProviderProbeSummary;
  attention: AttentionItem[];
  usage7d?: Usage7dStrip | null;
  generatedAt: string;
};

/** Default probe interval when enabled (minutes). */
export const DEFAULT_PROBE_INTERVAL_MINUTES = 15;
export const MIN_PROBE_INTERVAL_MINUTES = 5;
export const MAX_PROBE_INTERVAL_MINUTES = 1440;

/**
 * Clamp probe interval to 5..1440 minutes.
 * Non-finite / non-positive values fall back to the default (15).
 */
export function clampProbeIntervalMinutes(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PROBE_INTERVAL_MINUTES;
  return Math.min(
    MAX_PROBE_INTERVAL_MINUTES,
    Math.max(MIN_PROBE_INTERVAL_MINUTES, Math.round(n)),
  );
}

/**
 * Overall status:
 * - any component error → error
 * - any degraded OR demoMode → degraded
 * - else ok
 */
export function deriveOverall(input: {
  components: Array<{ status: ComponentStatus }>;
  demoMode: boolean;
}): ComponentStatus {
  if (input.components.some((c) => c.status === "error")) return "error";
  if (
    input.demoMode ||
    input.components.some(
      (c) => c.status === "degraded" || c.status === "unknown",
    )
  ) {
    return "degraded";
  }
  return "ok";
}

export type DemoModeInput = {
  providerMode: "fake" | "live";
  platform: {
    openai: boolean;
    anthropic: boolean;
    ollamaBaseUrl: boolean;
  };
  byokEnabledCount: number;
};

/**
 * Demo mode when fake provider, or live with no platform credentials and no enabled BYOK.
 */
export function deriveDemoMode(input: DemoModeInput): {
  demoMode: boolean;
  demoReasons: string[];
} {
  const reasons: string[] = [];
  if (input.providerMode !== "live") {
    reasons.push("PROVIDER_MODE is fake");
  }
  const hasPlatform =
    input.platform.openai ||
    input.platform.anthropic ||
    input.platform.ollamaBaseUrl;
  if (input.providerMode === "live" && !hasPlatform && input.byokEnabledCount === 0) {
    reasons.push("No platform keys and no enabled BYOK connection");
  }
  return { demoMode: reasons.length > 0, demoReasons: reasons };
}

export type DeriveAttentionInput = {
  components: HealthComponent[];
  connectivity: Pick<
    ConnectivitySnapshot,
    "demoMode" | "demoReasons" | "encryptionKeyConfigured" | "byok"
  >;
  probes: ProviderProbeSummary;
};

/**
 * Needs-attention items from health, demo mode, encryption, and probe results.
 */
export function deriveAttention(input: DeriveAttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const c of input.components) {
    if (c.status === "error") {
      items.push({
        id: `component-${c.id}-error`,
        severity: "critical",
        title: `${c.label} is down`,
        detail: c.detail ?? undefined,
      });
    } else if (c.status === "degraded") {
      items.push({
        id: `component-${c.id}-degraded`,
        severity: "warn",
        title: `${c.label} is degraded`,
        detail:
          c.id === "valkey"
            ? "Rate limits may fail closed when Valkey is unavailable"
            : (c.detail ?? undefined),
      });
    }
  }

  if (input.connectivity.demoMode) {
    items.push({
      id: "demo-mode",
      severity: "info",
      title: "Demo mode",
      detail: input.connectivity.demoReasons.join("; "),
      href: "/admin/providers",
    });
  }

  if (
    !input.connectivity.encryptionKeyConfigured &&
    input.connectivity.byok.total > 0
  ) {
    items.push({
      id: "encryption-missing",
      severity: "critical",
      title: "ENCRYPTION_KEY is not configured",
      detail: "BYOK credentials cannot be decrypted without ENCRYPTION_KEY",
      href: "/admin/providers",
    });
  }

  if (input.probes.enabled) {
    for (const r of input.probes.results) {
      if (r.ok === null || r.ok === undefined) {
        items.push({
          id: `probe-never-${r.connectionId}`,
          severity: "warn",
          title: `Connection “${r.name}” never probed`,
          href: "/admin/providers",
        });
      } else if (r.ok === false) {
        items.push({
          id: `probe-fail-${r.connectionId}`,
          severity: "warn",
          title: `Probe failed: ${r.name}`,
          detail: r.errorCode ?? undefined,
          href: "/admin/providers",
        });
      }
    }
  }

  return items;
}

/** Human labels for overall status in UI. */
export function overallLabel(status: ComponentStatus): string {
  switch (status) {
    case "ok":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "error":
      return "Down";
    default:
      return "Unknown";
  }
}
