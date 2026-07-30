import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Db = ReturnType<typeof createDb>;

/**
 * Create a DB handle. Prefer {@link getDb} in the web app so each request
 * does not open a new connection pool (that exhausts Postgres max_connections).
 */
export function createDb(
  databaseUrl: string,
  opts?: { max?: number },
) {
  const client = postgres(databaseUrl, { max: opts?.max ?? 10 });
  return drizzle(client, { schema });
}

let singleton: Db | null = null;
let singletonUrl: string | null = null;

/** Process-wide pool for request handlers. */
export function getDb(databaseUrl = process.env.DATABASE_URL): Db {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!singleton || singletonUrl !== databaseUrl) {
    singleton = createDb(databaseUrl, { max: 10 });
    singletonUrl = databaseUrl;
  }
  return singleton;
}

export function resetDbSingleton() {
  singleton = null;
  singletonUrl = null;
}

/** Cheap liveness check on the shared pool (`SELECT 1`). */
export async function pingDb(db: Db = getDb()): Promise<void> {
  await db.execute(sql`select 1`);
}
