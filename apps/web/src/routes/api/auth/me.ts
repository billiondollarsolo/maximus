import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@maximus/auth";
import { createDb } from "@maximus/db";
import { serverEnv } from "#/server/env";
import { sessionFromRequest } from "#/server/cookies";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = serverEnv();
        const db = createDb(env.databaseUrl);
        const ctx = await getAuthContext(sessionFromRequest(request), db);
        if (!ctx) {
          return Response.json({ user: null }, { status: 401 });
        }
        return Response.json({
          user: ctx.user,
          orgId: ctx.orgId,
          role: ctx.role,
        });
      },
    },
  },
});
