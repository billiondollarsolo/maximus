import { count } from "drizzle-orm";
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
import { AppError } from "@maximus/domain";
import { hashPassword } from "./password.js";
import { createSession } from "./session.js";

const MIN_PASSWORD_LEN = 10;

/** True when no users exist — first-run bootstrap UI may show. */
export async function needsBootstrap(db: Db = getDb()): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) === 0;
}

/**
 * Bootstrap first owner + org.
 * Only allowed when the users table is empty (first deploy).
 * Never mints a session for an existing user — use loginWithPassword.
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
  if (!input.email?.trim()) {
    throw new AppError("VALIDATION", "email required");
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LEN) {
    throw new AppError(
      "VALIDATION",
      `password must be at least ${MIN_PASSWORD_LEN} characters`,
    );
  }

  const [userCount] = await db.select({ n: count() }).from(users);
  const totalUsers = userCount?.n ?? 0;

  // Fail closed: any existing users means bootstrap is permanently closed.
  // Do not special-case existing emails (that was a passwordless takeover path).
  if (totalUsers > 0) {
    throw new AppError(
      "FORBIDDEN",
      "Bootstrap is only allowed when no users exist; use login or invite",
    );
  }

  const userId = newId("user");
  const orgId = newId("org");
  const baseSlug = (input.orgName ?? "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const email = input.email.toLowerCase().trim();

  await db.insert(users).values({
    id: userId,
    email,
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
