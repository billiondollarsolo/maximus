import { describe, expect, it } from "vitest";
import { buildModelCatalog } from "./build-model-catalog";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

function env(partial: Record<string, unknown> = {}) {
  return {
    appUrl: "http://localhost:3000",
    databaseUrl: DATABASE_URL,
    valkeyUrl: "redis://localhost:6379",
    encryptionKey: undefined,
    providerMode: "live" as const,
    openaiApiKey: undefined as string | undefined,
    anthropicApiKey: undefined as string | undefined,
    ollamaBaseUrl: undefined as string | undefined,
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
    ...partial,
  };
}

describe("buildModelCatalog", () => {
  it("live without keys and no org models → empty chat catalog", async () => {
    const { createDb, newId, organizations, organizationsExt, testMigrate } =
      await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Cat",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const { catalog, platform, models } = await buildModelCatalog({
      db,
      orgId,
      role: "owner",
      env: env({
        providerMode: "live",
        ollamaBaseUrl: "http://127.0.0.1:11434",
      }),
    });

    expect(platform).toEqual([]);
    expect(models).toEqual([]);
    expect(catalog).toEqual([]);
  });

  it("fake mode does not inject demo openai/anthropic without keys", async () => {
    const { createDb, newId, organizations, organizationsExt, testMigrate } =
      await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Fake",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const { models } = await buildModelCatalog({
      db,
      orgId,
      role: "member",
      env: env({ providerMode: "fake" }),
    });
    expect(models).toEqual([]);
  });

  it("only enabled org models appear — not all ollama tags", async () => {
    const {
      createDb,
      newId,
      organizations,
      organizationsExt,
      providerRepo,
      testMigrate,
    } = await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Byok",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "ollama",
      name: "Local Ollama",
      baseUrl: "http://10.0.0.5:11434",
      credentialsEncrypted: "x",
      hasSecret: false,
    });
    await providerRepo.createModel(db, {
      orgId,
      connectionId: conn.id,
      providerKind: "ollama",
      modelId: "gemma3:4b",
      displayName: "Gemma3:4b",
      modelRef: `ollama:${conn.id}:gemma3:4b`,
    });

    const { models } = await buildModelCatalog({
      db,
      orgId,
      role: "admin",
      env: env({ providerMode: "live" }),
    });

    expect(models.map((m) => m.modelRef)).toEqual([
      `ollama:${conn.id}:gemma3:4b`,
    ]);
  });

  it("platform openai key adds cloud models", async () => {
    const { createDb, newId, organizations, organizationsExt, testMigrate } =
      await import("@maximus/db");
    await testMigrate(DATABASE_URL);
    const db = createDb(DATABASE_URL);
    const orgId = newId("org");
    await db.insert(organizations).values({
      id: orgId,
      name: "Keys",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });

    const { models } = await buildModelCatalog({
      db,
      orgId,
      role: "owner",
      env: env({ providerMode: "live", openaiApiKey: "sk-test" }),
    });

    expect(models.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "openai:platform:gpt-4.1",
        "openai:platform:gpt-image-1",
      ]),
    );
    expect(models.some((m) => m.modelRef.startsWith("anthropic:"))).toBe(false);
  });
});
