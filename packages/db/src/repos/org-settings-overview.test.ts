import { describe, expect, it, beforeAll } from "vitest";
import { createDb, newId, organizations, organizationsExt } from "../index.js";
import { testMigrate } from "../test-migrate.js";
import {
  getOverviewProbeSettings,
  patchOverviewProbeSettings,
} from "./org-settings.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("overview probe settings", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(organizations).values({
      id: orgId,
      name: orgId,
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
  });

  it("defaults probes off with interval 15", async () => {
    const s = await getOverviewProbeSettings(db, orgId);
    expect(s.providerProbeEnabled).toBe(false);
    expect(s.providerProbeIntervalMinutes).toBe(15);
    expect(s.providerProbeLastRunAt).toBeNull();
  });

  it("clamps interval on patch", async () => {
    const s = await patchOverviewProbeSettings(db, orgId, {
      providerProbeEnabled: true,
      providerProbeIntervalMinutes: 2,
    });
    expect(s.providerProbeEnabled).toBe(true);
    expect(s.providerProbeIntervalMinutes).toBe(5);

    const s2 = await patchOverviewProbeSettings(db, orgId, {
      providerProbeIntervalMinutes: 99999,
    });
    expect(s2.providerProbeIntervalMinutes).toBe(1440);
  });
});
