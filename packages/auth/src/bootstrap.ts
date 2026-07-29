import { eq } from "drizzle-orm";
import {
  getDb,
  members,
  organizations,
  organizationsExt,
  accounts,
  users,
  newId,
  type Db,
} from "@maximus/db";
import { hashPassword } from "./password.js";
import { createSession } from "./session.js";

/**
 * Bootstrap first owner + org. Idempotent if email already exists.
 */
export async function bootstrapOwner(
  input: {
    email: string;
    password: string;
    name?: string;
    orgName?: string;
  },
  db: Db = getDb(),
): Promise<{ userId: string; orgId: string; sessionToken: string }> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing) {
    const [mem] = await db
      .select()
      .from(members)
      .where(eq(members.userId, existing.id))
      .limit(1);
    const token = await createSession(db, existing.id, mem?.organizationId);
    return {
      userId: existing.id,
      orgId: mem?.organizationId ?? "",
      sessionToken: token,
    };
  }

  const userId = newId("user");
  const orgId = newId("org");
  const baseSlug = (input.orgName ?? "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await db.insert(users).values({
    id: userId,
    email: input.email,
    name: input.name ?? "Owner",
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
    name: input.orgName ?? "Maximus Workspace",
    slug: `${baseSlug || "org"}-${orgId.slice(-6)}`,
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
