import { and, eq } from "drizzle-orm";
import { accounts, getDb, members, users, type Db } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { verifyPassword } from "./password.js";
import { createSession } from "./session.js";

export async function loginWithPassword(
  input: { email: string; password: string },
  db: Db = getDb(),
): Promise<{ sessionToken: string; userId: string; orgId: string }> {
  const email = input.email?.toLowerCase().trim();
  if (!email || !input.password) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new AppError("UNAUTHORIZED", "Invalid credentials");

  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")),
    )
    .limit(1);
  if (!account?.password || !verifyPassword(input.password, account.password)) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials");
  }

  const [mem] = await db
    .select()
    .from(members)
    .where(eq(members.userId, user.id))
    .limit(1);
  if (!mem) throw new AppError("FORBIDDEN", "No organization membership");

  // New session on each login (rotation)
  const sessionToken = await createSession(db, user.id, mem.organizationId);
  return { sessionToken, userId: user.id, orgId: mem.organizationId };
}
