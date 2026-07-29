import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  organizations,
  organizationsExt,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import { getOrgRateLimitFailOpen } from "./org-settings.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("getOrgRateLimitFailOpen", () => {
  const db = createDb(DATABASE_URL);
  const closedOrg = newId("org");
  const openOrg = newId("org");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    for (const [id, settings] of [
      [closedOrg, {}],
      [openOrg, { rateLimitFailOpen: true }],
    ] as const) {
      await db.insert(organizations).values({
        id,
        name: id,
        slug: id,
      });
      await db.insert(organizationsExt).values({ orgId: id, settings });
    }
  });

  it("defaults fail-closed when unset", async () => {
    expect(await getOrgRateLimitFailOpen(db, closedOrg)).toBe(false);
  });

  it("returns true when org opts fail-open", async () => {
    expect(await getOrgRateLimitFailOpen(db, openOrg)).toBe(true);
  });

  it("returns false for unknown org", async () => {
    expect(await getOrgRateLimitFailOpen(db, "missing-org")).toBe(false);
  });
});
