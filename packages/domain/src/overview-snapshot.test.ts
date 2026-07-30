import { describe, expect, it } from "vitest";
import {
  clampProbeIntervalMinutes,
  DEFAULT_PROBE_INTERVAL_MINUTES,
  deriveAttention,
  deriveDemoMode,
  deriveOverall,
  MAX_PROBE_INTERVAL_MINUTES,
  MIN_PROBE_INTERVAL_MINUTES,
  overallLabel,
  type HealthComponent,
  type ProviderProbeSummary,
} from "./overview-snapshot.js";

const checkedAt = "2026-07-30T12:00:00.000Z";

function component(
  id: string,
  status: HealthComponent["status"],
  extra?: Partial<HealthComponent>,
): HealthComponent {
  return {
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    status,
    checkedAt,
    ...extra,
  };
}

const emptyProbes: ProviderProbeSummary = {
  enabled: false,
  intervalMinutes: null,
  lastRunAt: null,
  nextRunAt: null,
  results: [],
};

describe("clampProbeIntervalMinutes", () => {
  it("defaults invalid values to 15", () => {
    expect(clampProbeIntervalMinutes(undefined)).toBe(
      DEFAULT_PROBE_INTERVAL_MINUTES,
    );
    expect(clampProbeIntervalMinutes(null)).toBe(DEFAULT_PROBE_INTERVAL_MINUTES);
    expect(clampProbeIntervalMinutes("nope")).toBe(
      DEFAULT_PROBE_INTERVAL_MINUTES,
    );
    expect(clampProbeIntervalMinutes(0)).toBe(DEFAULT_PROBE_INTERVAL_MINUTES);
    expect(clampProbeIntervalMinutes(-5)).toBe(DEFAULT_PROBE_INTERVAL_MINUTES);
  });

  it("clamps to 5..1440", () => {
    expect(clampProbeIntervalMinutes(1)).toBe(MIN_PROBE_INTERVAL_MINUTES);
    expect(clampProbeIntervalMinutes(5)).toBe(5);
    expect(clampProbeIntervalMinutes(15)).toBe(15);
    expect(clampProbeIntervalMinutes(2000)).toBe(MAX_PROBE_INTERVAL_MINUTES);
    expect(clampProbeIntervalMinutes("30")).toBe(30);
  });
});

describe("deriveDemoMode", () => {
  it("T1: fake → true", () => {
    const r = deriveDemoMode({
      providerMode: "fake",
      platform: { openai: false, anthropic: false, ollamaBaseUrl: false },
      byokEnabledCount: 0,
    });
    expect(r.demoMode).toBe(true);
    expect(r.demoReasons).toContain("PROVIDER_MODE is fake");
  });

  it("T2: live + platform key → false", () => {
    const r = deriveDemoMode({
      providerMode: "live",
      platform: { openai: true, anthropic: false, ollamaBaseUrl: false },
      byokEnabledCount: 0,
    });
    expect(r.demoMode).toBe(false);
    expect(r.demoReasons).toEqual([]);
  });

  it("T2b: live + enabled BYOK → false", () => {
    const r = deriveDemoMode({
      providerMode: "live",
      platform: { openai: false, anthropic: false, ollamaBaseUrl: false },
      byokEnabledCount: 1,
    });
    expect(r.demoMode).toBe(false);
  });

  it("T3: live + no keys + no BYOK → true", () => {
    const r = deriveDemoMode({
      providerMode: "live",
      platform: { openai: false, anthropic: false, ollamaBaseUrl: false },
      byokEnabledCount: 0,
    });
    expect(r.demoMode).toBe(true);
    expect(r.demoReasons).toContain(
      "No platform keys and no enabled BYOK connection",
    );
  });

  it("fake still demo even with platform keys", () => {
    const r = deriveDemoMode({
      providerMode: "fake",
      platform: { openai: true, anthropic: true, ollamaBaseUrl: true },
      byokEnabledCount: 3,
    });
    expect(r.demoMode).toBe(true);
  });
});

describe("deriveOverall", () => {
  it("T4: any error → error", () => {
    expect(
      deriveOverall({
        components: [component("app", "ok"), component("postgres", "error")],
        demoMode: false,
      }),
    ).toBe("error");
  });

  it("degraded when demoMode even if components ok", () => {
    expect(
      deriveOverall({
        components: [component("app", "ok")],
        demoMode: true,
      }),
    ).toBe("degraded");
  });

  it("degraded when any component degraded", () => {
    expect(
      deriveOverall({
        components: [component("valkey", "degraded")],
        demoMode: false,
      }),
    ).toBe("degraded");
  });

  it("unknown counts as degraded overall", () => {
    expect(
      deriveOverall({
        components: [component("storage", "unknown")],
        demoMode: false,
      }),
    ).toBe("degraded");
  });

  it("ok when all ok and not demo", () => {
    expect(
      deriveOverall({
        components: [
          component("app", "ok"),
          component("postgres", "ok"),
          component("valkey", "ok"),
          component("storage", "ok"),
        ],
        demoMode: false,
      }),
    ).toBe("ok");
  });

  it("error wins over demoMode", () => {
    expect(
      deriveOverall({
        components: [component("postgres", "error")],
        demoMode: true,
      }),
    ).toBe("error");
  });
});

describe("deriveAttention", () => {
  it("T5: demo + storage error produce expected severities", () => {
    const items = deriveAttention({
      components: [
        component("storage", "error", { label: "Object store", detail: "timeout" }),
        component("valkey", "degraded", { label: "Valkey" }),
      ],
      connectivity: {
        demoMode: true,
        demoReasons: ["PROVIDER_MODE is fake"],
        encryptionKeyConfigured: true,
        byok: { total: 0, enabled: 0, disabled: 0 },
      },
      probes: emptyProbes,
    });
    expect(items.find((i) => i.id === "component-storage-error")?.severity).toBe(
      "critical",
    );
    expect(items.find((i) => i.id === "component-valkey-degraded")?.severity).toBe(
      "warn",
    );
    expect(items.find((i) => i.id === "demo-mode")?.severity).toBe("info");
    expect(items.find((i) => i.id === "demo-mode")?.href).toBe(
      "/admin/providers",
    );
  });

  it("flags ENCRYPTION_KEY missing when BYOK exists", () => {
    const items = deriveAttention({
      components: [],
      connectivity: {
        demoMode: false,
        demoReasons: [],
        encryptionKeyConfigured: false,
        byok: { total: 2, enabled: 1, disabled: 1 },
      },
      probes: emptyProbes,
    });
    expect(items.some((i) => i.id === "encryption-missing")).toBe(true);
  });

  it("probe never / failed only when probes enabled", () => {
    const results = [
      {
        connectionId: "c1",
        name: "Prod OpenAI",
        kind: "openai",
        ok: null as boolean | null,
      },
      {
        connectionId: "c2",
        name: "Bad",
        kind: "openai",
        ok: false,
        errorCode: "UNAUTHORIZED",
      },
    ];
    const off = deriveAttention({
      components: [],
      connectivity: {
        demoMode: false,
        demoReasons: [],
        encryptionKeyConfigured: true,
        byok: { total: 0, enabled: 0, disabled: 0 },
      },
      probes: { ...emptyProbes, enabled: false, results },
    });
    expect(off.some((i) => i.id.startsWith("probe-"))).toBe(false);

    const on = deriveAttention({
      components: [],
      connectivity: {
        demoMode: false,
        demoReasons: [],
        encryptionKeyConfigured: true,
        byok: { total: 0, enabled: 0, disabled: 0 },
      },
      probes: {
        enabled: true,
        intervalMinutes: 15,
        lastRunAt: null,
        nextRunAt: null,
        results,
      },
    });
    expect(on.some((i) => i.id === "probe-never-c1")).toBe(true);
    expect(on.some((i) => i.id === "probe-fail-c2")).toBe(true);
  });
});

describe("overallLabel", () => {
  it("maps status to UI labels", () => {
    expect(overallLabel("ok")).toBe("Operational");
    expect(overallLabel("degraded")).toBe("Degraded");
    expect(overallLabel("error")).toBe("Down");
    expect(overallLabel("unknown")).toBe("Unknown");
  });
});
