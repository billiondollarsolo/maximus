import { and, eq, gt } from "drizzle-orm";
import {
  getDb,
  members,
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

/** Revoke a single session by token (logout). */
export async function revokeSession(
  token: string | null | undefined,
  db: Db = getDb(),
): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.token, token));
}
