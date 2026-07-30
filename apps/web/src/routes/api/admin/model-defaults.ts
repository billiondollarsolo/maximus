import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, getOrgSettings, patchOrgSettings, usageRepo } from "@maximus/db";
import { AppError, parseModelDefaults } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/model-defaults")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const settings = await getOrgSettings(db, ctx.orgId);
          return jsonOk({
            modelDefaults: parseModelDefaults(settings.modelDefaults),
            defaultModelRefs: Array.isArray(settings.defaultModelRefs)
              ? settings.defaultModelRefs
              : [],
            pinnedModelRefs: Array.isArray(settings.pinnedModelRefs)
              ? settings.pinnedModelRefs
              : [],
          });
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
            modelDefaults?: Record<string, unknown>;
            defaultModelRefs?: string[];
            pinnedModelRefs?: string[];
          };
          const patch: Record<string, unknown> = {};
          if (body.modelDefaults !== undefined) {
            if (
              body.modelDefaults !== null &&
              typeof body.modelDefaults !== "object"
            ) {
              throw new AppError("VALIDATION", "modelDefaults must be object");
            }
            patch.modelDefaults = parseModelDefaults(body.modelDefaults ?? {});
          }
          if (body.defaultModelRefs !== undefined) {
            patch.defaultModelRefs = Array.isArray(body.defaultModelRefs)
              ? body.defaultModelRefs.filter((x) => typeof x === "string")
              : [];
          }
          if (body.pinnedModelRefs !== undefined) {
            patch.pinnedModelRefs = Array.isArray(body.pinnedModelRefs)
              ? body.pinnedModelRefs.filter((x) => typeof x === "string")
              : [];
          }
          const next = await patchOrgSettings(db, ctx.orgId, patch);
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "org.model_defaults_updated",
            resourceType: "organization",
            resourceId: ctx.orgId,
            meta: { keys: Object.keys(patch) },
          });
          return jsonOk({
            modelDefaults: parseModelDefaults(next.modelDefaults),
            defaultModelRefs: next.defaultModelRefs ?? [],
            pinnedModelRefs: next.pinnedModelRefs ?? [],
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
