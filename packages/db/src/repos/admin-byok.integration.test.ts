import { describe, expect, it, beforeAll } from "vitest";
import { encryptSecret, generateEncryptionKey } from "@maximus/provider-gateway";
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
import * as usageRepo from "./usage.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("admin BYOK encryption + audit", () => {
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
      name: "Org",
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

  it("stores ciphertext not plaintext and writes audit", async () => {
    const apiKey = "sk-super-secret-key-value";
    const enc = encryptSecret(apiKey, key);
    expect(enc).not.toContain(apiKey);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai",
      name: "OpenAI BYOK",
      credentialsEncrypted: enc,
      createdBy: userId,
    });
    const reloaded = await providerRepo.getProviderConnection(db, conn.id);
    expect(reloaded?.credentialsEncrypted).toBe(enc);
    expect(reloaded?.credentialsEncrypted).not.toBe(apiKey);

    await usageRepo.insertAuditEvent(db, {
      orgId,
      actorUserId: userId,
      action: "provider.created",
      resourceType: "provider_connection",
      resourceId: conn.id,
    });

    const price = await usageRepo.findPrice(db, {
      orgId,
      providerKind: "openai",
      modelId: "gpt-4.1",
    });
    expect(price).not.toBeNull();
  });
});
