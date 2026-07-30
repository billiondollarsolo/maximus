import { describe, expect, it, beforeAll } from "vitest";
import {
  composeCatalog,
  defaultPlatformCatalog,
  modelsForUser,
  serializeModelRef,
} from "@maximus/domain";
import {
  encryptSecret,
  generateEncryptionKey,
} from "@maximus/provider-gateway";
import { createDb } from "../client.js";
import { newId } from "../ids.js";
import { testMigrate } from "../test-migrate.js";
import {
  members,
  organizations,
  organizationsExt,
  users,
} from "../schema/index.js";
import * as providerRepo from "./providers.js";
import * as pricesRepo from "./prices.js";
import * as usageRepo from "./usage.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("admin catalog repos", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const key = generateEncryptionKey();

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "Admin",
      email: `${userId}@t.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "OrgCat",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId,
      role: "admin",
    });
  });

  it("stores ciphertext, rotate changes it, ollama empty key ok", async () => {
    const apiKey = "sk-secret-rotate-test";
    const enc1 = encryptSecret(apiKey, key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "OpenAI",
      credentialsEncrypted: enc1,
      createdBy: userId,
    });
    expect(conn.credentialsEncrypted).not.toBe(apiKey);

    const enc2 = encryptSecret("sk-new-key", key);
    const rotated = await providerRepo.rotateProviderCredentials(db, {
      id: conn.id,
      orgId,
      credentialsEncrypted: enc2,
    });
    expect(rotated?.credentialsEncrypted).toBe(enc2);
    expect(rotated?.credentialsEncrypted).not.toBe(enc1);

    const ollamaEnc = encryptSecret("", key);
    const ollama = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "ollama",
      name: "Local Ollama",
      baseUrl: "http://127.0.0.1:11434",
      credentialsEncrypted: ollamaEnc,
      createdBy: userId,
    });
    expect(ollama.kind).toBe("ollama");
    expect(ollama.baseUrl).toBe("http://127.0.0.1:11434");
  });

  it("blocks hard delete when models exist", async () => {
    const enc = encryptSecret("sk-del", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "Del test",
      credentialsEncrypted: enc,
    });
    await providerRepo.createModel(db, {
      orgId,
      connectionId: conn.id,
      providerKind: "openai",
      modelId: "gpt-test",
      displayName: "GPT Test",
      modelRef: `openai:${conn.id}:gpt-test`,
    });
    const blocked = await providerRepo.deleteProviderConnection(db, {
      id: conn.id,
      orgId,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("models_exist");

    await providerRepo.updateProviderConnection(db, {
      id: conn.id,
      orgId,
      isEnabled: false,
    });
    const reloaded = await providerRepo.getProviderConnectionForOrg(
      db,
      orgId,
      conn.id,
    );
    expect(reloaded?.isEnabled).toBe(false);
  });

  it("hard deletes connection when no models", async () => {
    const enc = encryptSecret("sk-free", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "Free conn",
      credentialsEncrypted: enc,
    });
    const result = await providerRepo.deleteProviderConnection(db, {
      id: conn.id,
      orgId,
    });
    expect(result.ok).toBe(true);
  });

  it("org price overrides platform seed for findPrice", async () => {
    const platform = await usageRepo.findPrice(db, {
      orgId,
      providerKind: "openai",
      modelId: "gpt-4.1",
    });
    expect(platform).not.toBeNull();
    expect(platform!.source).toBe("pattern");

    await pricesRepo.createOrgPrice(db, {
      orgId,
      providerKind: "openai",
      modelIdPattern: "gpt-4.1",
      inputUsdPer1m: 99,
      outputUsdPer1m: 199,
    });

    const overridden = await usageRepo.findPrice(db, {
      orgId,
      providerKind: "openai",
      modelId: "gpt-4.1",
    });
    expect(overridden).not.toBeNull();
    expect(overridden!.inputUsdPer1m).toBe(99);
    expect(overridden!.source).toBe("pattern");
  });

  it("model row rates beat pattern table for same modelRef", async () => {
    const enc = encryptSecret("sk-price", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "Priced conn",
      credentialsEncrypted: enc,
    });
    const modelRef = `openai:${conn.id}:gpt-priced`;
    await providerRepo.createModel(db, {
      orgId,
      connectionId: conn.id,
      providerKind: "openai",
      modelId: "gpt-priced",
      displayName: "Priced",
      modelRef,
      inputUsdPer1m: 1.5,
      outputUsdPer1m: 6,
    });
    const price = await usageRepo.findPrice(db, {
      orgId,
      providerKind: "openai",
      modelId: "gpt-priced",
      modelRef,
    });
    expect(price?.source).toBe("model");
    expect(price?.inputUsdPer1m).toBe(1.5);
    expect(price?.outputUsdPer1m).toBe(6);
  });

  it("cannot delete platform seed via org delete", async () => {
    const prices = await pricesRepo.listPrices(db, orgId);
    const platformSeed = prices.find((p) => p.orgId == null);
    expect(platformSeed).toBeDefined();
    const deleted = await pricesRepo.deleteOrgPrice(db, {
      id: platformSeed!.id,
      orgId,
    });
    expect(deleted).toBeNull();
  });

  it("allowlist delete removes rule", async () => {
    const rule = await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef: "openai:platform:gpt-4.1",
      role: "member",
    });
    const removed = await providerRepo.deleteAllowlist(db, {
      id: rule.id,
      orgId,
    });
    expect(removed?.id).toBe(rule.id);
    const remaining = await providerRepo.listAllowlist(db, orgId);
    expect(remaining.find((r) => r.id === rule.id)).toBeUndefined();
  });

  it("updates and deletes models", async () => {
    const m = await providerRepo.createModel(db, {
      orgId,
      providerKind: "openai",
      modelId: "custom",
      displayName: "Custom",
      modelRef: `openai:platform:custom-${orgId}`,
      capabilities: { streaming: true, vision: true },
    });
    const updated = await providerRepo.updateModel(db, {
      id: m.id,
      orgId,
      displayName: "Custom Renamed",
      isEnabled: false,
    });
    expect(updated?.displayName).toBe("Custom Renamed");
    expect(updated?.isEnabled).toBe(false);
    const del = await providerRepo.deleteModel(db, { id: m.id, orgId });
    expect(del?.id).toBe(m.id);
  });

  it("BYOK model merges with platform catalog for members", async () => {
    const enc = encryptSecret("", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "ollama",
      name: "Merge Ollama",
      baseUrl: "http://127.0.0.1:11434",
      credentialsEncrypted: enc,
      hasSecret: false,
    });
    const modelRef = serializeModelRef({
      providerKind: "ollama",
      connectionId: conn.id,
      modelId: "llama3.2-merge",
    });
    await providerRepo.createModel(db, {
      orgId,
      connectionId: conn.id,
      providerKind: "ollama",
      modelId: "llama3.2-merge",
      displayName: "Llama merge",
      modelRef,
    });
    const orgModels = await providerRepo.listModels(db, orgId);
    const orgCatalog = orgModels.map((m) => ({
      modelRef: m.modelRef,
      displayName: m.displayName,
      providerKind: m.providerKind,
      isEnabled: m.isEnabled,
      sortOrder: m.sortOrder,
    }));

    // No platform keys → chat has only intentional org offerings (no demos).
    const emptyPlatform = composeCatalog({
      platform: defaultPlatformCatalog({ providerMode: "live" }),
      orgModels: orgCatalog,
    });
    const emptyRefs = modelsForUser(emptyPlatform, "member", []).map(
      (m) => m.modelRef,
    );
    expect(emptyRefs.some((r) => r.startsWith("openai:platform:"))).toBe(false);
    expect(emptyRefs).toContain(modelRef);

    // With OpenAI key → platform cloud models merge with BYOK offerings.
    const withKeys = composeCatalog({
      platform: defaultPlatformCatalog({
        providerMode: "live",
        openai: true,
      }),
      orgModels: orgCatalog,
    });
    const keyedRefs = modelsForUser(withKeys, "member", []).map(
      (m) => m.modelRef,
    );
    expect(keyedRefs.some((r) => r.startsWith("openai:platform:"))).toBe(true);
    expect(keyedRefs).toContain(modelRef);
  });
});
