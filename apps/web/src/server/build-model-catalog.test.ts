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
  it("live without keys has no cloud platform; discovers ollama platform", async () => {
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
      listOllama: async () => [
        { name: "llama3.2:latest" },
        { name: "codellama" },
      ],
    });

    expect(platform.every((m) => !m.modelRef.startsWith("openai:"))).toBe(true);
    expect(platform.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "ollama:platform:llama3.2:latest",
        "ollama:platform:codellama",
      ]),
    );
    expect(models.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "ollama:platform:llama3.2:latest",
        "ollama:platform:codellama",
      ]),
    );
    expect(catalog.some((m) => m.modelRef === "openai:platform:gpt-4.1")).toBe(
      false,
    );
  });

  it("fake mode still shows openai/anthropic without keys", async () => {
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
      listOllama: async () => [],
    });
    expect(models.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "openai:platform:gpt-4.1",
        "anthropic:platform:claude-sonnet-4",
      ]),
    );
    expect(models.some((m) => m.modelRef.includes("llama3.2"))).toBe(false);
  });

  it("discovers BYOK ollama connection models", async () => {
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

    const called: string[] = [];
    const { models } = await buildModelCatalog({
      db,
      orgId,
      role: "admin",
      env: env({ providerMode: "live" }),
      listOllama: async (input) => {
        called.push(input.baseUrl);
        if (input.baseUrl.includes("10.0.0.5")) {
          return [{ name: "deepseek-r1" }];
        }
        return [];
      },
    });

    expect(called).toContain("http://10.0.0.5:11434");
    expect(models.map((m) => m.modelRef)).toContain(
      `ollama:${conn.id}:deepseek-r1`,
    );
  });
});
