import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Db = ReturnType<typeof createDb>;

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

let singleton: Db | null = null;

export function getDb(databaseUrl = process.env.DATABASE_URL): Db {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!singleton) {
    singleton = createDb(databaseUrl);
  }
  return singleton;
}

export function resetDbSingleton() {
  singleton = null;
}
