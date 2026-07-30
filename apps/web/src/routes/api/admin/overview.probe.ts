import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, usageRepo } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";
import {
  buildOverviewSnapshot,
  getOverviewEnv,
} from "#/server/overview/build-overview-snapshot";
import { runProviderProbes } from "#/server/overview/run-provider-probes";

/** In-process rate limit: 1 manual probe per org per minute. */
const lastManualProbe = new Map<string, number>();

export const Route = createFileRoute("/api/admin/overview/probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = getOverviewEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");

          const now = Date.now();
          const prev = lastManualProbe.get(ctx.orgId) ?? 0;
          if (now - prev < 60_000) {
            throw new AppError(
              "RATE_LIMITED",
              "Probe all is limited to once per minute",
              429,
            );
          }
          lastManualProbe.set(ctx.orgId, now);

          const { ran, results } = await runProviderProbes({
            db,
            orgId: ctx.orgId,
            env,
          });

          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "overview.probed",
            resourceType: "org_settings",
            resourceId: ctx.orgId,
            meta: { ran, okCount: results.filter((r) => r.ok).length },
          });

          const snapshot = await buildOverviewSnapshot({
            db,
            orgId: ctx.orgId,
            env,
          });

          return jsonOk({ ran, results, snapshot });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
