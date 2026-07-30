import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import {
  exportOrgCatalog,
  getDb,
  importOrgCatalog,
  type CatalogExportPayload,
  usageRepo,
} from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/catalog-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const payload = await exportOrgCatalog(db, ctx.orgId);
          return jsonOk(payload);
        } catch (err) {
          return jsonError(err);
        }
      },
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            catalog?: CatalogExportPayload;
            dryRun?: boolean;
            conflict?: "skip" | "overwrite";
          };
          if (!body.catalog || typeof body.catalog !== "object") {
            throw new AppError("VALIDATION", "catalog payload required");
          }
          const result = await importOrgCatalog(db, ctx.orgId, body.catalog, {
            dryRun: body.dryRun === true,
            conflict: body.conflict === "overwrite" ? "overwrite" : "skip",
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: body.dryRun
              ? "catalog.import_dry_run"
              : "catalog.import_applied",
            resourceType: "organization",
            resourceId: ctx.orgId,
            meta: {
              connections: result.connections,
              models: result.models,
              allowlist: result.allowlist,
            },
          });
          return jsonOk({ result });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
