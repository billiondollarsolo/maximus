import { describe, expect, it, beforeAll } from "vitest";
import { createDb, newId, testMigrate } from "@maximus/db";
import { bootstrapOwner } from "./bootstrap.js";
import { loginWithPassword } from "./login.js";
import {
  acceptInvite,
  createInvite,
  publicSignUpDisabled,
} from "./invite.js";
import { getAuthContext, requireAuth } from "./session.js";
import { AppError, canAdminOrg } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("auth invite-only + roles", () => {
  const db = createDb(DATABASE_URL);
  const email = `owner-${newId()}@test.local`;

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
  });

  it("bootstraps owner, logs in, invites member, denies public signup", async () => {
    const boot = await bootstrapOwner(
      { email, password: "OwnerPass123!", name: "Owner", orgName: "Acme" },
      db,
    );
    expect(boot.orgId).toBeTruthy();

    const login = await loginWithPassword(
      { email, password: "OwnerPass123!" },
      db,
    );
    const ctx = await requireAuth(login.sessionToken, db);
    expect(ctx.role).toBe("owner");
    expect(canAdminOrg(ctx.role)).toBe(true);

    const inv = await createInvite(
      ctx,
      { email: `member-${newId()}@test.local`, role: "member" },
      db,
    );
    const accepted = await acceptInvite(
      { inviteId: inv.id, password: "MemberPass123!", name: "Member" },
      db,
    );
    const memberCtx = await getAuthContext(accepted.sessionToken, db);
    expect(memberCtx?.role).toBe("member");
    expect(canAdminOrg(memberCtx!.role)).toBe(false);

    expect(() => publicSignUpDisabled()).toThrow(AppError);
  });
});
