import { createFileRoute } from "@tanstack/react-router";
import { revokeSession } from "@maximus/auth";
import { createDb } from "@maximus/db";
import {
  clearSessionCookieHeader,
  sessionFromRequest,
} from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          await revokeSession(sessionFromRequest(request), db);
          return jsonOk(
            { ok: true },
            { headers: { "Set-Cookie": clearSessionCookieHeader() } },
          );
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
