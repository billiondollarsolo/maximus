import { and, eq } from "drizzle-orm";
import {
  accounts,
  getDb,
  invitations,
  members,
  users,
  newId,
  type Db,
} from "@maximus/db";
import { AppError, canManageMembers, type OrgRole } from "@maximus/domain";
import { hashPassword } from "./password.js";
import { createSession, type AuthContext } from "./session.js";

export async function createInvite(
  ctx: AuthContext,
  input: { email: string; role: OrgRole },
  db: Db = getDb(),
) {
  if (!canManageMembers(ctx.role)) {
    throw new AppError("FORBIDDEN", "Cannot invite members");
  }
  if (input.role === "owner" && ctx.role !== "owner") {
    throw new AppError("FORBIDDEN", "Only owner can invite owners");
  }
  const id = newId("inv");
  const [row] = await db
    .insert(invitations)
    .values({
      id,
      organizationId: ctx.orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      inviterId: ctx.user.id,
    })
    .returning();
  return row!;
}

/**
 * Accept invite: creates user if needed, membership, session.
 * Public registration without invite is not supported.
 */
export async function acceptInvite(
  input: {
    inviteId: string;
    password: string;
    name?: string;
  },
  db: Db = getDb(),
) {
  const [inv] = await db
    .select()
    .from(invitations)
    .where(
      and(eq(invitations.id, input.inviteId), eq(invitations.status, "pending")),
    )
    .limit(1);
  if (!inv || inv.expiresAt < new Date()) {
    throw new AppError("NOT_FOUND", "Invite not found or expired");
  }

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, inv.email))
    .limit(1);

  if (!user) {
    const userId = newId("user");
    await db.insert(users).values({
      id: userId,
      email: inv.email,
      name: input.name ?? inv.email.split("@")[0]!,
      emailVerified: true,
    });
    await db.insert(accounts).values({
      id: newId("acc"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashPassword(input.password),
    });
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  }

  await db.insert(members).values({
    id: newId("mem"),
    organizationId: inv.organizationId,
    userId: user!.id,
    role: inv.role ?? "member",
  });
  await db
    .update(invitations)
    .set({ status: "accepted" })
    .where(eq(invitations.id, inv.id));

  const sessionToken = await createSession(db, user!.id, inv.organizationId);
  return {
    sessionToken,
    userId: user!.id,
    orgId: inv.organizationId,
  };
}

/** Public signup is disabled — always throws. */
export function publicSignUpDisabled(): never {
  throw new AppError("FORBIDDEN", "Public registration is disabled; invite only");
}
