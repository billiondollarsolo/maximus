import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  organizations,
  organizationsExt,
  users,
  members,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import * as providerRepo from "./providers.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("upsertAllowlist idempotency", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "A",
      email: `${userId}@t.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "A",
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

  it("re-POST same allowlist rule is idempotent (no throw, same id)", async () => {
    const modelRef = `openai:platform:upsert-test-${newId()}`;
    const a = await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef,
      role: null,
    });
    const b = await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef,
      role: null,
    });
    expect(b.id).toBe(a.id);
    const list = await providerRepo.listAllowlist(db, orgId);
    const matches = list.filter((r) => r.modelRef === modelRef);
    expect(matches).toHaveLength(1);
  });
});
