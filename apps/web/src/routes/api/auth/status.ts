import { createFileRoute } from "@tanstack/react-router";
import { needsBootstrap } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { serverEnv } from "#/server/env";
import { jsonOk, jsonError } from "#/server/api";

export const Route = createFileRoute("/api/auth/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          return jsonOk({ needsBootstrap: await needsBootstrap(db) });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
