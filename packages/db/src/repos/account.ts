import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import {
  accounts,
  members,
  organizations,
  sessions,
  users,
} from "../schema/index.js";
import * as conversationRepo from "./conversations.js";

/**
 * Hard-delete the current user account and their conversations in this org.
 * If they are the sole owner and only member, also removes the org (cascade).
 * Does not allow leaving an org without owner if other members exist.
 */
export async function deleteUserAccount(
  db: Db,
  input: { userId: string; orgId: string },
): Promise<{ deleted: true; orgDeleted: boolean }> {
  // Wipe user's chats in this org first (messages cascade via conv delete)
  await conversationRepo.deleteConversationsForUser(db, {
    orgId: input.orgId,
    userId: input.userId,
  });

  const orgMembers = await db
    .select()
    .from(members)
    .where(eq(members.organizationId, input.orgId));

  const myMembership = orgMembers.find((m) => m.userId === input.userId);
  if (!myMembership) {
    throw new Error("Not a member of this organization");
  }

  const others = orgMembers.filter((m) => m.userId !== input.userId);
  let orgDeleted = false;

  if (others.length === 0) {
    // Solo org — remove org (cascades members, etc.)
    await db.delete(organizations).where(eq(organizations.id, input.orgId));
    orgDeleted = true;
  } else if (myMembership.role === "owner") {
    const otherOwners = others.filter((m) => m.role === "owner");
    if (otherOwners.length === 0) {
      throw new Error(
        "Transfer ownership or remove other members before deleting your account",
      );
    }
    await db
      .delete(members)
      .where(
        and(
          eq(members.organizationId, input.orgId),
          eq(members.userId, input.userId),
        ),
      );
  } else {
    await db
      .delete(members)
      .where(
        and(
          eq(members.organizationId, input.orgId),
          eq(members.userId, input.userId),
        ),
      );
  }

  // If user has no remaining memberships, delete user + sessions + credentials
  const remaining = await db
    .select()
    .from(members)
    .where(eq(members.userId, input.userId));
  if (remaining.length === 0) {
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
    await db.delete(accounts).where(eq(accounts.userId, input.userId));
    await db.delete(users).where(eq(users.id, input.userId));
  }

  return { deleted: true, orgDeleted };
}
