import { describe, expect, it } from "vitest";
import type { HealthComponent, OverviewSnapshot } from "@maximus/domain";
import { buildOverviewSnapshot } from "./build-overview-snapshot";
import { probesAreDue } from "./run-provider-probes";

const checkedAt = "2026-07-30T12:00:00.000Z";

function ok(id: string, label: string): HealthComponent {
  return {
    id,
    label,
    status: "ok",
    latencyMs: 1,
    detail: null,
    checkedAt,
  };
}

/** Minimal fake db surface for injected path — only used if checks don't hit DB helpers.
 * We fully mock checks + stub overviewRepo via inject... Actually buildOverviewSnapshot
 * always calls overviewRepo. Integration path needs real DB. Unit path: skip if no DATABASE_URL
 * and use a lightweight mock by testing probesAreDue + secret-free shape of assembly logic.
 */

describe("probesAreDue", () => {
  it("false when disabled", () => {
    expect(
      probesAreDue({
        enabled: false,
        intervalMinutes: 15,
        lastRunAt: null,
      }),
    ).toBe(false);
  });

  it("true when enabled and never run", () => {
    expect(
      probesAreDue({
        enabled: true,
        intervalMinutes: 15,
        lastRunAt: null,
      }),
    ).toBe(true);
  });

  it("true when interval elapsed", () => {
    const now = new Date("2026-07-30T12:20:00.000Z");
    expect(
      probesAreDue({
        enabled: true,
        intervalMinutes: 15,
        lastRunAt: "2026-07-30T12:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("false when interval not elapsed", () => {
    const now = new Date("2026-07-30T12:05:00.000Z");
    expect(
      probesAreDue({
        enabled: true,
        intervalMinutes: 15,
        lastRunAt: "2026-07-30T12:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });
});

describe("buildOverviewSnapshot (injected checks)", () => {
  const DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgres://maximus:maximus@localhost:5432/maximus";

  it("assembles demo mode + components without secrets", async () => {
    const { createDb, newId, organizations, organizationsExt, testMigrate } =
      await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Overview Org",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const snapshot: OverviewSnapshot = await buildOverviewSnapshot({
      db,
      orgId,
      env: {
        appUrl: "http://localhost:3000",
        databaseUrl: DATABASE_URL,
        valkeyUrl: "redis://localhost:6379",
        encryptionKey: undefined,
        providerMode: "fake",
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        ollamaBaseUrl: undefined,
        allowPrivateBaseUrls: true,
        rateLimitFailOpen: false,
        userPerMin: 60,
        orgPerMin: 600,
        s3: {
          endpoint: "http://localhost:9000",
          accessKey: "maximus",
          secretKey: "maximussecret",
          bucket: "maximus-uploads",
        },
        appVersion: "0.0.0-test",
        gitSha: "deadbeef",
        nodeEnv: "test",
      },
      checks: {
        postgres: async () => ok("postgres", "Postgres"),
        valkey: async () => ok("valkey", "Valkey"),
        storage: async () => ok("storage", "Object store"),
      },
    });

    expect(snapshot.overall).toBe("degraded"); // demo mode
    expect(snapshot.connectivity.demoMode).toBe(true);
    expect(snapshot.connectivity.providerMode).toBe("fake");
    expect(snapshot.components.map((c) => c.id).sort()).toEqual(
      ["app", "postgres", "storage", "valkey"].sort(),
    );
    expect(snapshot.probes.enabled).toBe(false);
    expect(snapshot.version).toBe("0.0.0-test");
    expect(snapshot.usage7d).toBeDefined();

    const blob = JSON.stringify(snapshot);
    expect(blob).not.toMatch(/maximussecret/);
    expect(blob).not.toMatch(/sk-/);
    expect(blob).not.toMatch(/postgres:\/\/maximus:maximus/);
    expect(blob).not.toContain("ENCRYPTION_KEY=");
  });

  it("live + platform key is not demo", async () => {
    const { createDb, newId, organizations, organizationsExt, testMigrate } =
      await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Live Org",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const snapshot = await buildOverviewSnapshot({
      db,
      orgId,
      env: {
        appUrl: "http://localhost:3000",
        databaseUrl: DATABASE_URL,
        valkeyUrl: "redis://localhost:6379",
        encryptionKey: "x".repeat(64),
        providerMode: "live",
        openaiApiKey: "sk-test-not-real",
        anthropicApiKey: undefined,
        ollamaBaseUrl: undefined,
        allowPrivateBaseUrls: true,
        rateLimitFailOpen: false,
        userPerMin: 60,
        orgPerMin: 600,
        s3: {
          endpoint: "http://localhost:9000",
          accessKey: "maximus",
          secretKey: "maximussecret",
          bucket: "maximus-uploads",
        },
        appVersion: null,
        gitSha: null,
        nodeEnv: "test",
      },
      checks: {
        postgres: async () => ok("postgres", "Postgres"),
        valkey: async () => ok("valkey", "Valkey"),
        storage: async () => ok("storage", "Object store"),
      },
    });

    expect(snapshot.connectivity.demoMode).toBe(false);
    expect(snapshot.connectivity.platform.openai).toBe(true);
    expect(snapshot.overall).toBe("ok");
    // key presence only — not the key value
    expect(JSON.stringify(snapshot)).not.toContain("sk-test-not-real");
  });
});
