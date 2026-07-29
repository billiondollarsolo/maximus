import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = dirname(fileURLToPath(import.meta.url));

/** Shared migrate for integration tests with advisory lock. */
export async function testMigrate(
  url = process.env.DATABASE_URL ??
    "postgres://maximus:maximus@localhost:5432/maximus",
) {
  const sql = postgres(url, { max: 1 });
  await sql`SELECT pg_advisory_lock(424242)`;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const migrationsDir = join(dir, "migrations");
    for (const file of readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const applied =
        await sql`SELECT id FROM schema_migrations WHERE id = ${file}`;
      if (applied.length) continue;
      const body = readFileSync(join(migrationsDir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      });
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(424242)`;
    await sql.end();
  }
}
