import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import {
  accessGrantsRepo,
  getDb,
  getOrgSettings,
  usageRepo,
} from "@maximus/db";
import { AppError, parseAccessMode } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";
import { buildModelCatalog } from "#/server/build-model-catalog";

export const Route = createFileRoute("/api/admin/access-grants")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const settings = await getOrgSettings(db, ctx.orgId);
          const grants = await accessGrantsRepo.listAccessGrants(db, ctx.orgId);
          // Same platform+org composition as chat catalog (pre-grant filter)
          // so admins can grant platform models when env keys are set.
          const composed = await buildModelCatalog({
            db,
            orgId: ctx.orgId,
            role: ctx.role,
            userId: ctx.user.id,
            env,
          });
          const offerings = composed.catalog
            .filter((m) => m.isEnabled !== false && m.isVisible !== false)
            .map((m) => ({
              modelRef: m.modelRef,
              displayName: m.displayName,
            }));
          return jsonOk({
            accessMode: parseAccessMode(settings.accessMode),
            grants,
            offerings,
          });
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
            resourceType?: "model" | "agent";
            resourceRef?: string;
            subjectType?: "org" | "role" | "team" | "user";
            subjectId?: string | null;
          };
          if (!body.resourceRef?.trim() || !body.subjectType) {
            throw new AppError(
              "VALIDATION",
              "resourceRef and subjectType required",
            );
          }
          const row = await accessGrantsRepo.createAccessGrant(db, {
            orgId: ctx.orgId,
            resourceType: body.resourceType ?? "model",
            resourceRef: body.resourceRef.trim(),
            subjectType: body.subjectType,
            subjectId: body.subjectId,
            createdBy: ctx.user.id,
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "access_grant.created",
            resourceType: "access_grant",
            resourceId: row.id,
            meta: {
              resourceRef: row.resourceRef,
              subjectType: row.subjectType,
              subjectId: row.subjectId,
            },
          });
          return jsonOk({ grant: row });
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
            accessMode?: "open" | "allowlist";
          };
          if (body.accessMode !== "open" && body.accessMode !== "allowlist") {
            throw new AppError("VALIDATION", "accessMode must be open|allowlist");
          }
          await accessGrantsRepo.setOrgAccessMode(
            db,
            ctx.orgId,
            body.accessMode,
          );
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "org.access_mode_updated",
            resourceType: "organization",
            resourceId: ctx.orgId,
            meta: { accessMode: body.accessMode },
          });
          return jsonOk({ accessMode: body.accessMode });
        } catch (err) {
          return jsonError(err);
        }
      },
      DELETE: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as { id?: string };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const row = await accessGrantsRepo.deleteAccessGrant(db, {
            id: body.id,
            orgId: ctx.orgId,
          });
          if (!row) throw new AppError("NOT_FOUND", "Grant not found");
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "access_grant.deleted",
            resourceType: "access_grant",
            resourceId: body.id,
            meta: {},
          });
          return jsonOk({ ok: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
