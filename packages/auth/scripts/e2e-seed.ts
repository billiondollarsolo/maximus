/**
 * Ensure a known e2e owner exists.
 * Run: pnpm --filter @maximus/auth exec tsx scripts/e2e-seed.ts
 */
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
} from "@maximus/db";
import { bootstrapOwner, hashPassword, loginWithPassword } from "../src/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "maximus-e2e@test.local";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2eTestPass99!";

async function main() {
  await testMigrate(DATABASE_URL);
  const db = createDb(DATABASE_URL);
  try {
    const [row] = await db.select({ n: count() }).from(users);

    if ((row?.n ?? 0) === 0) {
      await bootstrapOwner(
        {
          email: E2E_EMAIL,
          password: E2E_PASSWORD,
          name: "E2E Owner",
          orgName: "E2E Workspace",
        },
        db,
      );
      console.info("bootstrapped", E2E_EMAIL);
      return;
    }

    try {
      await loginWithPassword(
        { email: E2E_EMAIL, password: E2E_PASSWORD },
        db,
      );
      console.info("login ok", E2E_EMAIL);
      return;
    } catch {
      // fall through
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, E2E_EMAIL))
      .limit(1);
    if (existing) {
      console.info("user exists with different password:", E2E_EMAIL);
      return;
    }

    const userId = newId("user");
    const orgId = newId("org");
    await db.insert(users).values({
      id: userId,
      email: E2E_EMAIL,
      name: "E2E Owner",
      emailVerified: true,
    });
    await db.insert(accounts).values({
      id: newId("acc"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashPassword(E2E_PASSWORD),
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "E2E Workspace",
      slug: `e2e-${orgId.slice(-6)}`,
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
    console.info("created", E2E_EMAIL);
  } finally {
    // postgres.js pools hang the process without explicit exit
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
