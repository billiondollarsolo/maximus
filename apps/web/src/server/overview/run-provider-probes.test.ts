import { describe, expect, it, vi } from "vitest";
import { runProviderProbes } from "./run-provider-probes";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("runProviderProbes", () => {
  it("uses testProviderConnection and persists results", async () => {
    const {
      createDb,
      newId,
      organizations,
      organizationsExt,
      providerRepo,
      overviewRepo,
      testMigrate,
    } = await import("@maximus/db");
    const { encryptSecret, generateEncryptionKey } = await import(
      "@maximus/provider-gateway"
    );

    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    const key = generateEncryptionKey();

    await db.insert(organizations).values({
      id: orgId,
      name: "Probe Org",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const enc = encryptSecret("sk-probe-secret", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "Test OpenAI",
      credentialsEncrypted: enc,
    });

    const seen: Array<{ kind?: string; apiKey?: string }> = [];
    const testConnection = async (input: {
      kind: string;
      baseUrl?: string | null;
      apiKey?: string | null;
      allowPrivateBaseUrls?: boolean;
    }) => {
      seen.push({ kind: input.kind, apiKey: input.apiKey ?? undefined });
      return { ok: true, latencyMs: 12 };
    };

    const { ran, results } = await runProviderProbes({
      db,
      orgId,
      env: {
        appUrl: "http://localhost:3000",
        databaseUrl: DATABASE_URL,
        valkeyUrl: "redis://localhost:6379",
        encryptionKey: key,
        providerMode: "live",
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        ollamaBaseUrl: undefined,
        allowPrivateBaseUrls: true,
        rateLimitFailOpen: false,
        userPerMin: 60,
        orgPerMin: 600,
        trustProxy: false,
        trustedProxyHops: 1,
        s3: {
          endpoint: "http://localhost:9000",
          accessKey: "a",
          secretKey: "b",
          bucket: "c",
        },
      },
      testConnection: testConnection as never,
    });

    expect(ran).toBe(1);
    expect(results[0]?.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      kind: "openai",
      apiKey: "sk-probe-secret",
    });

    const listed = await overviewRepo.listProviderProbeResults(db, orgId);
    const row = listed.find((r) => r.connectionId === conn.id);
    expect(row?.ok).toBe(true);
    expect(row?.latencyMs).toBe(12);
  });

  it("T10: disabled path never requires probes from empty enabled list", async () => {
    // When no enabled connections, testConnection is never called.
    const {
      createDb,
      newId,
      organizations,
      organizationsExt,
      testMigrate,
    } = await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Empty",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const testConnection = vi.fn();
    const { ran } = await runProviderProbes({
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
        trustProxy: false,
        trustedProxyHops: 1,
        s3: {
          endpoint: "http://localhost:9000",
          accessKey: "a",
          secretKey: "b",
          bucket: "c",
        },
      },
      testConnection,
    });
    expect(ran).toBe(0);
    expect(testConnection).not.toHaveBeenCalled();
  });
});
