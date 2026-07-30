import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@maximus/auth";
import { createDb } from "@maximus/db";
import { serverEnv } from "#/server/env";
import { sessionFromRequest } from "#/server/cookies";
import { jsonError, jsonOk } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await getAuthContext(sessionFromRequest(request), db);
          if (!ctx) {
            return withSecurityHeaders(
              Response.json({ user: null }, { status: 401 }),
            );
          }
          return jsonOk({
            user: ctx.user,
            orgId: ctx.orgId,
            role: ctx.role,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
