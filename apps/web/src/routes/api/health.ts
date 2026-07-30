import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";
import { serverEnv } from "#/server/env";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const env = serverEnv();
        const checks: Record<string, string> = { app: "ok" };
        try {
          const sql = postgres(env.databaseUrl, { max: 1 });
          await sql`select 1`;
          await sql.end({ timeout: 2 });
          checks.postgres = "ok";
        } catch {
          checks.postgres = "error";
        }
        try {
          const Redis = (await import("ioredis")).default;
          const r = new Redis(env.valkeyUrl, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableOfflineQueue: false,
          });
          await r.connect();
          const pong = await r.ping();
          await r.quit();
          checks.valkey = pong === "PONG" ? "ok" : "error";
        } catch {
          checks.valkey = "error";
        }
        const ok =
          checks.postgres === "ok" &&
          (checks.valkey === "ok" || process.env.HEALTH_SOFT === "true");
        return withSecurityHeaders(
          Response.json(
            { status: ok ? "ok" : "degraded", checks },
            { status: ok ? 200 : 503 },
          ),
        );
      },
    },
  },
});
