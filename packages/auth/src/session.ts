import { and, eq, gt } from "drizzle-orm";
import {
  getDb,
  members,
  organizations,
  sessions,
  users,
  newId,
  type Db,
} from "@maximus/db";
import type { OrgRole } from "@maximus/domain";
import { AppError, hasMinRole } from "@maximus/domain";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthContext = {
  user: SessionUser;
  orgId: string;
  role: OrgRole;
  sessionToken: string;
};

export async function createSession(
  db: Db,
  userId: string,
  activeOrganizationId?: string | null,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<string> {
  const token = newId("sess");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await db.insert(sessions).values({
    id: newId("sid"),
    token,
    userId,
    expiresAt,
    activeOrganizationId: activeOrganizationId ?? null,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });
  return token;
}

export async function getAuthContext(
  token: string | null | undefined,
  db: Db = getDb(),
): Promise<AuthContext | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      sessionToken: sessions.token,
      expiresAt: sessions.expiresAt,
      activeOrganizationId: sessions.activeOrganizationId,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  let orgId = row.activeOrganizationId;
  let role: OrgRole = "member";

  if (orgId) {
    const [mem] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.organizationId, orgId), eq(members.userId, row.userId)),
      )
      .limit(1);
    if (!mem) return null;
    role = mem.role as OrgRole;
  } else {
    const [mem] = await db
      .select()
      .from(members)
      .where(eq(members.userId, row.userId))
      .limit(1);
    if (!mem) return null;
    orgId = mem.organizationId;
    role = mem.role as OrgRole;
  }

  return {
    user: { id: row.userId, email: row.email, name: row.name },
    orgId: orgId!,
    role,
    sessionToken: row.sessionToken,
  };
}

export async function requireAuth(
  token: string | null | undefined,
  db?: Db,
): Promise<AuthContext> {
  const ctx = await getAuthContext(token, db);
  if (!ctx) throw new AppError("UNAUTHORIZED", "Authentication required");
  return ctx;
}

export function requireOrgRole(ctx: AuthContext, min: OrgRole): void {
  if (!hasMinRole(ctx.role, min)) {
    throw new AppError("FORBIDDEN", "Insufficient role");
  }
}

export type OrgMembership = {
  orgId: string;
  role: OrgRole;
  name: string;
  slug: string;
};

/** All org memberships for a user (for me payload / switcher). */
export async function listUserOrgMemberships(
  db: Db,
  userId: string,
): Promise<OrgMembership[]> {
  const rows = await db
    .select({
      orgId: members.organizationId,
      role: members.role,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(eq(members.userId, userId));
  return rows.map((r) => ({
    orgId: r.orgId,
    role: r.role as OrgRole,
    name: r.name,
    slug: r.slug,
  }));
}

/**
 * Switch active org (and optional team) on session.
 * Fails if user is not a member of orgId.
 */
export async function switchActiveContext(
  db: Db,
  input: {
    sessionToken: string;
    userId: string;
    orgId: string;
  },
): Promise<AuthContext> {
  const [mem] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.organizationId, input.orgId),
        eq(members.userId, input.userId),
      ),
    )
    .limit(1);
  if (!mem) {
    throw new AppError("FORBIDDEN", "Not a member of that organization");
  }
  await db
    .update(sessions)
    .set({ activeOrganizationId: input.orgId, updatedAt: new Date() })
    .where(eq(sessions.token, input.sessionToken));
  const ctx = await getAuthContext(input.sessionToken, db);
  if (!ctx) throw new AppError("UNAUTHORIZED", "Session invalid after switch");
  return ctx;
}

/** Revoke a single session by token (logout). */
export async function revokeSession(
  token: string | null | undefined,
  db: Db = getDb(),
): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.token, token));
}
