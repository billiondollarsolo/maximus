import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, usageQueryRepo } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const url = new URL(request.url);
          const action = url.searchParams.get("action") ?? undefined;
          const sinceRaw = url.searchParams.get("since");
          const since = sinceRaw ? new Date(sinceRaw) : undefined;
          const limit = Number(url.searchParams.get("limit") ?? 100);
          const events = await usageQueryRepo.listAudit(db, {
            orgId: ctx.orgId,
            action,
            since:
              since && !Number.isNaN(since.getTime()) ? since : undefined,
            limit: Number.isFinite(limit) ? Math.min(500, limit) : 100,
          });
          return jsonOk({ events });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
