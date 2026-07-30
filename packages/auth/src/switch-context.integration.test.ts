import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  members,
  newId,
  organizations,
  organizationsExt,
  users,
  testMigrate,
} from "@maximus/db";
import {
  createSession,
  getAuthContext,
  switchActiveContext,
} from "./session.js";
import { AppError } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("switchActiveContext", () => {
  const db = createDb(DATABASE_URL);
  const userId = newId("user");
  const orgA = newId("org");
  const orgB = newId("org");
  let token = "";

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "Multi",
      email: `${userId}@t.local`,
    });
    for (const orgId of [orgA, orgB]) {
      await db.insert(organizations).values({
        id: orgId,
        name: orgId,
        slug: orgId,
      });
      await db.insert(organizationsExt).values({ orgId, settings: {} });
      await db.insert(members).values({
        id: newId("mem"),
        organizationId: orgId,
        userId,
        role: "member",
      });
    }
    token = await createSession(db, userId, orgA);
  });

  it("defaults to active org A", async () => {
    const ctx = await getAuthContext(token, db);
    expect(ctx?.orgId).toBe(orgA);
  });

  it("switches to org B when member", async () => {
    const next = await switchActiveContext(db, {
      sessionToken: token,
      userId,
      orgId: orgB,
    });
    expect(next.orgId).toBe(orgB);
    const ctx = await getAuthContext(token, db);
    expect(ctx?.orgId).toBe(orgB);
  });

  it("rejects non-membership", async () => {
    await expect(
      switchActiveContext(db, {
        sessionToken: token,
        userId,
        orgId: newId("org"),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
