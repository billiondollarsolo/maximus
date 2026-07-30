import { describe, expect, it, beforeAll } from "vitest";
import { createDb } from "../client.js";
import { newId } from "../ids.js";
import { testMigrate } from "../test-migrate.js";
import {
  members,
  organizations,
  organizationsExt,
  users,
  modelAllowlists,
} from "../schema/index.js";
import * as accessGrantsRepo from "./access-grants.js";
import * as teamsRepo from "./teams.js";
import { modelsForUser } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("access grants + teams integration", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userA = newId("user");
  const userB = newId("user");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values([
      { id: userA, name: "Alice", email: `${userA}@t.local` },
      { id: userB, name: "Bob", email: `${userB}@t.local` },
    ]);
    await db.insert(organizations).values({
      id: orgId,
      name: "AccessOrg",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values([
      {
        id: newId("mem"),
        organizationId: orgId,
        userId: userA,
        role: "member",
      },
      {
        id: newId("mem"),
        organizationId: orgId,
        userId: userB,
        role: "member",
      },
    ]);
  });

  it("open mode catalog ignores grants", async () => {
    await accessGrantsRepo.setOrgAccessMode(db, orgId, "open");
    await accessGrantsRepo.createAccessGrant(db, {
      orgId,
      resourceType: "model",
      resourceRef: "ollama:c1:only-a",
      subjectType: "user",
      subjectId: userA,
    });
    const { accessMode, grants } = await accessGrantsRepo.loadAccessForOrg(
      db,
      orgId,
    );
    expect(accessMode).toBe("open");
    const cat = modelsForUser(
      [
        {
          modelRef: "ollama:c1:only-a",
          displayName: "a",
          providerKind: "ollama",
          isEnabled: true,
        },
        {
          modelRef: "ollama:c1:other",
          displayName: "o",
          providerKind: "ollama",
          isEnabled: true,
        },
      ],
      "member",
      [],
      { accessMode, grants, userId: userB, teamIds: [] },
    );
    expect(cat.map((m) => m.modelRef).sort()).toEqual([
      "ollama:c1:only-a",
      "ollama:c1:other",
    ]);
  });

  it("allowlist + team membership filters catalog", async () => {
    const team = await teamsRepo.createTeam(db, {
      orgId,
      name: "Eng",
      slug: "eng",
    });
    await teamsRepo.addTeamMember(db, { teamId: team.id, userId: userA });
    await accessGrantsRepo.setOrgAccessMode(db, orgId, "allowlist");
    // clear prior grants from previous test noise by creating team grant
    await accessGrantsRepo.createAccessGrant(db, {
      orgId,
      resourceType: "model",
      resourceRef: "ollama:c1:gemma",
      subjectType: "team",
      subjectId: team.id,
    });

    const access = await accessGrantsRepo.loadAccessForOrg(db, orgId);
    const teamIdsA = await teamsRepo.listTeamIdsForUser(db, orgId, userA);
    const teamIdsB = await teamsRepo.listTeamIdsForUser(db, orgId, userB);

    const catalog = [
      {
        modelRef: "ollama:c1:gemma",
        displayName: "g",
        providerKind: "ollama",
        isEnabled: true,
      },
    ];

    const forA = modelsForUser(catalog, "member", [], {
      accessMode: "allowlist",
      grants: access.grants,
      userId: userA,
      teamIds: teamIdsA,
    });
    const forB = modelsForUser(catalog, "member", [], {
      accessMode: "allowlist",
      grants: access.grants,
      userId: userB,
      teamIds: teamIdsB,
    });
    expect(forA.map((m) => m.modelRef)).toContain("ollama:c1:gemma");
    // B may still have only-a user grant from previous test if accessMode allowlist
    expect(forB.map((m) => m.modelRef)).not.toContain("ollama:c1:gemma");
  });

  it("migrates legacy allowlist rows into grants + allowlist mode", async () => {
    const org2 = newId("org");
    await db.insert(organizations).values({
      id: org2,
      name: "Legacy",
      slug: org2,
    });
    await db.insert(organizationsExt).values({ orgId: org2, settings: {} });
    await db.insert(modelAllowlists).values({
      id: newId("al"),
      orgId: org2,
      modelRef: "openai:platform:gpt-4.1",
      role: "admin",
    });
    // ensure migration path when grants empty
    const result = await accessGrantsRepo.ensureAllowlistMigrated(db, org2);
    expect(result.migrated).toBeGreaterThanOrEqual(1);
    expect(result.accessMode).toBe("allowlist");
    const grants = await accessGrantsRepo.listAccessGrants(db, org2);
    expect(
      grants.some(
        (g) =>
          g.resourceRef === "openai:platform:gpt-4.1" &&
          g.subjectType === "role" &&
          g.subjectId === "admin",
      ),
    ).toBe(true);
  });
});
