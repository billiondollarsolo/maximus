import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, usageQueryRepo } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/usage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const usage = await usageQueryRepo.listUsage(db, {
            orgId: ctx.orgId,
          });
          return jsonOk({ usage });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
