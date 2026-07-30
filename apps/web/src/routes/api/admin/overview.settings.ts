import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import {
  getDb,
  getOverviewProbeSettings,
  patchOverviewProbeSettings,
  usageRepo,
} from "@maximus/db";
import { AppError, clampProbeIntervalMinutes } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/admin/overview/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const settings = await getOverviewProbeSettings(db, ctx.orgId);
          return jsonOk({ settings });
        } catch (err) {
          return jsonError(err);
        }
      },
      PATCH: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            providerProbeEnabled?: boolean;
            providerProbeIntervalMinutes?: number;
          };

          if (
            body.providerProbeEnabled === undefined &&
            body.providerProbeIntervalMinutes === undefined
          ) {
            throw new AppError(
              "VALIDATION",
              "providerProbeEnabled or providerProbeIntervalMinutes required",
            );
          }

          const settings = await patchOverviewProbeSettings(db, ctx.orgId, {
            providerProbeEnabled: body.providerProbeEnabled,
            providerProbeIntervalMinutes:
              body.providerProbeIntervalMinutes !== undefined
                ? clampProbeIntervalMinutes(body.providerProbeIntervalMinutes)
                : undefined,
          });

          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "overview.settings_updated",
            resourceType: "org_settings",
            resourceId: ctx.orgId,
            meta: {
              providerProbeEnabled: settings.providerProbeEnabled,
              providerProbeIntervalMinutes:
                settings.providerProbeIntervalMinutes,
            },
          });

          return jsonOk({ settings });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
