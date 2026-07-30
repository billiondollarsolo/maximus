import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, usageQueryRepo } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const events = await usageQueryRepo.listAudit(db, {
            orgId: ctx.orgId,
          });
          return jsonOk({ events });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
