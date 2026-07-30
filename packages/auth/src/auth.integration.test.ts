import { describe, expect, it, beforeAll } from "vitest";
import { count, eq } from "drizzle-orm";
import {
  accounts,
  createDb,
  members,
  newId,
  organizations,
  organizationsExt,
  testMigrate,
  users,
  type Db,
} from "@maximus/db";
import { AppError, canAdminOrg, isAppError } from "@maximus/domain";
import { bootstrapOwner } from "./bootstrap.js";
import { loginWithPassword } from "./login.js";
import {
  acceptInvite,
  createInvite,
  publicSignUpDisabled,
} from "./invite.js";
import { createSession, getAuthContext, requireAuth } from "./session.js";
import { hashPassword } from "./password.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

/** Create owner when DB already has users (shared test DB). */
async function createOwnerWhenDbNotEmpty(
  db: Db,
  input: { email: string; password: string; name: string; orgName: string },
) {
  const userId = newId("user");
  const orgId = newId("org");
  await db.insert(users).values({
    id: userId,
    email: input.email,
    name: input.name,
    emailVerified: true,
  });
  await db.insert(accounts).values({
    id: newId("acc"),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashPassword(input.password),
  });
  await db.insert(organizations).values({
    id: orgId,
    name: input.orgName,
    slug: `org-${orgId.slice(-8)}`,
  });
  await db.insert(organizationsExt).values({
    orgId,
    settings: { rateLimitFailOpen: false },
  });
  await db.insert(members).values({
    id: newId("mem"),
    organizationId: orgId,
    userId,
    role: "owner",
  });
  const sessionToken = await createSession(db, userId, orgId);
  return { userId, orgId, sessionToken };
}

describe("auth invite-only + roles", () => {
  const db = createDb(DATABASE_URL);
  const email = `owner-${newId()}@test.local`;

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
  });

  it("owner login, invite member, deny public signup; bootstrap locked when users exist", async () => {
    const [userCount] = await db.select({ n: count() }).from(users);
    const empty = (userCount?.n ?? 0) === 0;

    let boot: { userId: string; orgId: string; sessionToken: string };
    if (empty) {
      boot = await bootstrapOwner(
        {
          email,
          password: "OwnerPass123!",
          name: "Owner",
          orgName: "Acme",
        },
        db,
      );
    } else {
      boot = await createOwnerWhenDbNotEmpty(db, {
        email,
        password: "OwnerPass123!",
        name: "Owner",
        orgName: "Acme",
      });
    }
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

    // New email when users exist
    await expect(
      bootstrapOwner(
        {
          email: `other-${newId()}@test.local`,
          password: "AnotherPass99!",
          name: "Intruder",
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bootstrap with EXISTING email does not mint session (wrong or any password)", async () => {
    // Ensure a known user exists in DB
    const knownEmail = `known-${newId()}@test.local`;
    const knownPassword = "KnownPass99!";
    await createOwnerWhenDbNotEmpty(db, {
      email: knownEmail,
      password: knownPassword,
      name: "Known",
      orgName: "KnownOrg",
    });

    // Wrong password must not session (and must not succeed silently)
    await expect(
      bootstrapOwner(
        {
          email: knownEmail,
          password: "WrongPassword99!",
          name: "Attacker",
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Correct password also must not session via bootstrap — only login may
    await expect(
      bootstrapOwner(
        {
          email: knownEmail,
          password: knownPassword,
          name: "Attacker",
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Login with correct password still works (auth path is separate)
    const login = await loginWithPassword(
      { email: knownEmail, password: knownPassword },
      db,
    );
    expect(login.sessionToken).toBeTruthy();
    const ctx = await getAuthContext(login.sessionToken, db);
    expect(ctx?.user.email).toBe(knownEmail);

    // Login with wrong password does not session
    await expect(
      loginWithPassword(
        { email: knownEmail, password: "WrongPassword99!" },
        db,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects short bootstrap password", async () => {
    try {
      await bootstrapOwner(
        {
          email: `short-${newId()}@test.local`,
          password: "short",
          name: "X",
        },
        db,
      );
      expect.fail("should throw");
    } catch (e) {
      expect(isAppError(e)).toBe(true);
      // Empty DB → VALIDATION; non-empty → FORBIDDEN (users exist checked first after password length)
      // Password length is checked BEFORE user count, so always VALIDATION for short passwords.
      expect(e).toMatchObject({ code: "VALIDATION" });
    }
  });

  it("bootstrap real path when DB empty OR FORBIDDEN when not", async () => {
    const [userCount] = await db.select({ n: count() }).from(users);
    const empty = (userCount?.n ?? 0) === 0;
    const tryEmail = `boot-path-${newId()}@test.local`;
    if (empty) {
      const r = await bootstrapOwner(
        {
          email: tryEmail,
          password: "BootstrapOk99!",
          name: "First",
          orgName: "Fresh",
        },
        db,
      );
      expect(r.userId).toBeTruthy();
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, tryEmail))
        .limit(1);
      expect(row).toBeTruthy();
    } else {
      await expect(
        bootstrapOwner(
          {
            email: tryEmail,
            password: "BootstrapOk99!",
            name: "First",
            orgName: "Fresh",
          },
          db,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
