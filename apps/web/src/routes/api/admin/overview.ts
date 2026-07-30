import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { jsonError, jsonOk } from "#/server/api";
import {
  buildOverviewSnapshot,
  getOverviewEnv,
} from "#/server/overview/build-overview-snapshot";

export const Route = createFileRoute("/api/admin/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = getOverviewEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const snapshot = await buildOverviewSnapshot({
            db,
            orgId: ctx.orgId,
            env,
          });
          return jsonOk(snapshot);
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
