import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const features = join(import.meta.dirname);

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function readFeature(name: string) {
  return readFileSync(join(features, name), "utf8");
}

describe("admin overview live dashboard (structural)", () => {
  it("ships live EventSource helper + overview dashboard modules", () => {
    expect(existsSync(join(root, "features/live/use-event-source.ts"))).toBe(
      true,
    );
    expect(existsSync(join(features, "overview-dashboard.tsx"))).toBe(true);
    expect(existsSync(join(features, "status-pill.tsx"))).toBe(true);
    expect(
      existsSync(join(root, "routes/api/admin/overview.ts")),
    ).toBe(true);
    expect(
      existsSync(join(root, "routes/api/admin/overview.stream.ts")),
    ).toBe(true);
    expect(
      existsSync(join(root, "routes/api/admin/overview.settings.ts")),
    ).toBe(true);
    expect(
      existsSync(join(root, "routes/api/admin/overview.probe.ts")),
    ).toBe(true);
  });

  it("Overview uses live stream + poll fallback", () => {
    const dash = readFeature("overview-dashboard.tsx");
    expect(dash).toContain("useEventSource");
    expect(dash).toContain("/api/admin/overview/stream");
    expect(dash).toContain("pollUrl");
    expect(dash).toContain("/api/admin/overview");
    expect(dash).toContain("Demo mode");
    expect(dash).toContain("Needs attention");
    expect(dash).toContain("Connectivity");
    expect(dash).toContain("LiveIndicator");
    expect(dash).toContain("Configure probes");
    expect(dash).toContain("Probe all now");
  });

  it("useEventSource wraps EventSource", () => {
    const src = read("features/live/use-event-source.ts");
    expect(src).toContain("EventSource");
    expect(src).toContain("pollUrl");
    expect(src).toContain("reconnecting");
  });

  it("admin index mounts OverviewDashboard not static counts only", () => {
    const idx = read("routes/admin.index.tsx");
    expect(idx).toContain("OverviewDashboard");
    expect(idx).not.toContain("setUsageCount");
    expect(idx).toContain("AdminShell");
  });

  it("SSE stream route uses text/event-stream and snapshot event", () => {
    const src = read("routes/api/admin/overview.stream.ts");
    expect(src).toContain("text/event-stream");
    expect(src).toContain('event: ${event}');
    expect(src).toContain("snapshot");
    expect(src).toContain("requireOrgRole");
    expect(src).toContain("runProviderProbes");
  });

  it("probe settings default off and audit on patch", () => {
    const settings = read("routes/api/admin/overview.settings.ts");
    expect(settings).toContain("overview.settings_updated");
    expect(settings).toContain("guardMutation");
    const probe = read("routes/api/admin/overview.probe.ts");
    expect(probe).toContain("runProviderProbes");
    expect(probe).toContain("RATE_LIMITED");
  });
});
