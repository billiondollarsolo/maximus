import { describe, expect, it, beforeAll } from "vitest";
import { createDb } from "../client.js";
import { newId } from "../ids.js";
import { testMigrate } from "../test-migrate.js";
import {
  members,
  organizations,
  organizationsExt,
  users,
} from "../schema/index.js";
import * as attachmentsRepo from "./attachments.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

/**
 * Drives shipped getAttachmentForOrg: same-org hit, cross-org miss.
 * Mirrors GET /api/attachments/$id authz (handler uses this repo).
 */
describe("attachmentsRepo org isolation", () => {
  const db = createDb(DATABASE_URL);
  const orgA = newId("org");
  const orgB = newId("org");
  const userA = newId("user");
  const userB = newId("user");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    for (const [id, email] of [
      [userA, `${userA}@a.local`],
      [userB, `${userB}@b.local`],
    ] as const) {
      await db.insert(users).values({ id, name: "U", email });
    }
    for (const [id, name] of [
      [orgA, "OrgA"],
      [orgB, "OrgB"],
    ] as const) {
      await db.insert(organizations).values({ id, name, slug: id });
      await db.insert(organizationsExt).values({ orgId: id, settings: {} });
    }
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgA,
      userId: userA,
      role: "owner",
    });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgB,
      userId: userB,
      role: "owner",
    });
  });

  it("getAttachmentForOrg returns row for same org only", async () => {
    const att = await attachmentsRepo.createAttachment(db, {
      orgId: orgA,
      uploaderUserId: userA,
      storageKey: `org/${orgA}/att/iso`,
      filename: "iso.png",
      mime: "image/png",
      sizeBytes: 12,
      meta: { source: "user" },
    });

    const hit = await attachmentsRepo.getAttachmentForOrg(db, orgA, att.id);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe(att.id);
    expect(hit!.orgId).toBe(orgA);
    expect(hit!.filename).toBe("iso.png");

    const miss = await attachmentsRepo.getAttachmentForOrg(db, orgB, att.id);
    expect(miss).toBeNull();
  });
});
