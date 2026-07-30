import { describe, expect, it, beforeAll } from "vitest";
import {
  assertExportHasNoSecrets,
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
import { exportOrgCatalog, importOrgCatalog } from "./catalog-export.js";
import { getOrgSettings } from "./org-settings.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("catalog export/import round-trip", () => {
  const db = createDb(DATABASE_URL);
  const sourceOrgId = newId("org");
  const targetOrgId = newId("org");
  const userId = newId("user");
  const key = generateEncryptionKey();

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "Exporter",
      email: `${userId}@t.local`,
    });
    for (const orgId of [sourceOrgId, targetOrgId]) {
      await db.insert(organizations).values({
        id: orgId,
        name: orgId,
        slug: orgId,
      });
      await db.insert(organizationsExt).values({
        orgId,
        settings: {},
      });
      await db.insert(members).values({
        id: newId("mem"),
        organizationId: orgId,
        userId,
        role: "owner",
      });
    }

    // Source org: secret-bearing connection + models + allowlist + settings
    const secret = "sk-live-super-secret-key-do-not-export";
    const enc = encryptSecret(secret, key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId: sourceOrgId,
      kind: "openai",
      name: "Prod OpenAI",
      baseUrl: "https://api.openai.com/v1",
      credentialsEncrypted: enc,
      hasSecret: true,
    });
    const modelRef = serializeModelRef({
      providerKind: "openai",
      connectionId: conn.id,
      modelId: "gpt-4.1-mini",
    });
    await providerRepo.createModel(db, {
      orgId: sourceOrgId,
      connectionId: conn.id,
      providerKind: "openai",
      modelId: "gpt-4.1-mini",
      displayName: "GPT-4.1 Mini",
      modelRef,
      capabilities: {
        streaming: true,
        temperature: 0.2,
        topP: 0.95,
        stop: ["END"],
        contextWindow: 128000,
        maxOutputTokens: 4096,
      },
    });
    await providerRepo.upsertAllowlist(db, {
      orgId: sourceOrgId,
      modelRef,
      role: "member",
    });
    const { patchOrgSettings } = await import("./org-settings.js");
    await patchOrgSettings(db, sourceOrgId, {
      modelDefaults: { temperature: 0.5, contextWindow: 8192 },
      defaultModelRefs: [modelRef],
      pinnedModelRefs: [],
    });
  });

  it("export strips secrets; import restores models/allowlist/settings into empty org", async () => {
    const exported = await exportOrgCatalog(db, sourceOrgId);
    assertExportHasNoSecrets(exported);
    const raw = JSON.stringify(exported);
    expect(raw).not.toMatch(/sk-live-super-secret/);
    expect(raw).not.toMatch(/"apiKey"\s*:\s*"/);
    expect(raw).not.toMatch(/"credentialsEncrypted"\s*:\s*"[^"]{8,}"/);
    expect(exported.connections[0]?.hasCredentials).toBe(true);
    expect(
      (exported.connections[0] as { credentialsEncrypted?: string })
        .credentialsEncrypted,
    ).toBeUndefined();

    // Target org starts empty of models
    expect(await providerRepo.listModels(db, targetOrgId)).toHaveLength(0);

    const applied = await importOrgCatalog(
      db,
      targetOrgId,
      exported as Parameters<typeof importOrgCatalog>[2],
      {
        dryRun: false,
        conflict: "skip",
      },
    );
    expect(applied.connections.created).toBe(1);
    expect(applied.models.created).toBe(1);
    expect(applied.allowlist.created).toBe(1);
    expect(applied.settingsApplied).toBe(true);

    const models = await providerRepo.listModels(db, targetOrgId);
    expect(models).toHaveLength(1);
    expect(models[0]!.modelId).toBe("gpt-4.1-mini");
    expect(models[0]!.displayName).toBe("GPT-4.1 Mini");
    expect(models[0]!.capabilities).toMatchObject({
      temperature: 0.2,
      topP: 0.95,
      contextWindow: 128000,
    });

    // Connection remapped (new id) and no secret material stored as the original
    const conns = await providerRepo.listProviderConnections(db, targetOrgId);
    expect(conns).toHaveLength(1);
    expect(conns[0]!.name).toBe("Prod OpenAI");
    expect(conns[0]!.credentialsEncrypted).toBe("");
    expect(models[0]!.connectionId).toBe(conns[0]!.id);
    expect(models[0]!.modelRef).toBe(
      serializeModelRef({
        providerKind: "openai",
        connectionId: conns[0]!.id,
        modelId: "gpt-4.1-mini",
      }),
    );

    const allow = await providerRepo.listAllowlist(db, targetOrgId);
    expect(allow.map((a) => a.modelRef)).toEqual([models[0]!.modelRef]);

    const settings = await getOrgSettings(db, targetOrgId);
    expect(settings.modelDefaults).toMatchObject({ temperature: 0.5 });
    expect(settings.defaultModelRefs).toEqual([models[0]!.modelRef]);

    // Idempotent re-import
    const again = await importOrgCatalog(
      db,
      targetOrgId,
      exported as Parameters<typeof importOrgCatalog>[2],
      {
        conflict: "skip",
      },
    );
    expect(again.connections.skipped).toBe(1);
    expect(again.models.skipped).toBe(1);
    expect(await providerRepo.listModels(db, targetOrgId)).toHaveLength(1);
  });
});
