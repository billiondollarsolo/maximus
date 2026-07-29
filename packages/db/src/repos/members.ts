import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { invitations, members, users } from "../schema/index.js";

export async function listMembers(db: Db, orgId: string) {
  return db
    .select({
      memberId: members.id,
      userId: members.userId,
      role: members.role,
      email: users.email,
      name: users.name,
      createdAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.organizationId, orgId));
}

export async function setMemberRole(
  db: Db,
  input: { orgId: string; userId: string; role: string },
) {
  const [row] = await db
    .update(members)
    .set({ role: input.role })
    .where(
      and(
        eq(members.organizationId, input.orgId),
        eq(members.userId, input.userId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function removeMember(
  db: Db,
  input: { orgId: string; userId: string },
) {
  await db
    .delete(members)
    .where(
      and(
        eq(members.organizationId, input.orgId),
        eq(members.userId, input.userId),
      ),
    );
}

export async function listPendingInvites(db: Db, orgId: string) {
  return db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, orgId),
        eq(invitations.status, "pending"),
      ),
    );
}
