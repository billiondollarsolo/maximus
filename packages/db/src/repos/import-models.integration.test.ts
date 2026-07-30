import { describe, expect, it, beforeAll } from "vitest";
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

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("importModelsOnConnection (import_tags core)", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const key = generateEncryptionKey();
  let connId = "";

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "Imp",
      email: `${userId}@t.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "ImportOrg",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId,
      role: "admin",
    });
    const enc = encryptSecret("", key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "ollama",
      name: "Local",
      baseUrl: "http://10.0.0.9:11434",
      credentialsEncrypted: enc,
      hasSecret: false,
    });
    connId = conn.id;
  });

  it("first import creates N; re-import yields created:0 skipped:N", async () => {
    const names = ["gemma3:4b", "qwen2.5:1.5b", "llama3.2:latest"];
    const items = names.map((modelId) => ({
      modelId,
      displayName: modelId,
      capabilities: {
        streaming: true,
        contextWindow: 8192,
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
      isEnabled: true,
      isVisible: true,
    }));

    const first = await providerRepo.importModelsOnConnection(db, {
      orgId,
      connectionId: connId,
      providerKind: "ollama",
      items,
    });
    expect(first.created).toBe(3);
    expect(first.skipped).toBe(0);
    expect(first.modelRefs).toHaveLength(3);

    const second = await providerRepo.importModelsOnConnection(db, {
      orgId,
      connectionId: connId,
      providerKind: "ollama",
      items,
    });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(3);

    const listed = await providerRepo.listModelsForConnection(db, connId);
    expect(listed).toHaveLength(3);
    expect(listed.map((m) => m.modelId).sort()).toEqual([...names].sort());
  });
});
