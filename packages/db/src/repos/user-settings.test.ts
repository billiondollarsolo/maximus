import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  organizations,
  organizationsExt,
  users,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import {
  getCustomInstructions,
  upsertCustomInstructions,
} from "./user-settings.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("user-settings custom instructions", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "U",
      email: `${userId}@t.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "O",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
  });

  it("upserts and reads", async () => {
    expect(await getCustomInstructions(db, { userId, orgId })).toBeNull();
    const saved = await upsertCustomInstructions(db, {
      userId,
      orgId,
      aboutUser: "I build APIs",
      preferredResponse: "be concise",
    });
    expect(saved.aboutUser).toBe("I build APIs");
    const reloaded = await getCustomInstructions(db, { userId, orgId });
    expect(reloaded?.preferredResponse).toBe("be concise");

    await upsertCustomInstructions(db, {
      userId,
      orgId,
      preferredResponse: "detailed",
    });
    const again = await getCustomInstructions(db, { userId, orgId });
    expect(again?.aboutUser).toBe("I build APIs");
    expect(again?.preferredResponse).toBe("detailed");
  });
});
