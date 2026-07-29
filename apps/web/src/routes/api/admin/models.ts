import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, providerRepo, usageRepo } from "@maximus/db";
import { AppError, isAppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/admin/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const [models, allowlist] = await Promise.all([
            providerRepo.listModels(db, ctx.orgId),
            providerRepo.listAllowlist(db, ctx.orgId),
          ]);
          return Response.json({ models, allowlist });
        } catch (err) {
          if (isAppError(err) || err instanceof AppError) {
            return Response.json(
              { error: err.message, code: err.code },
              { status: err.status },
            );
          }
          return Response.json({ error: "Failed" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            action?: "allowlist" | "create";
            modelRef?: string;
            role?: string | null;
            providerKind?: string;
            modelId?: string;
            displayName?: string;
            connectionId?: string;
          };
          if (body.action === "allowlist" && body.modelRef) {
            const row = await providerRepo.upsertAllowlist(db, {
              orgId: ctx.orgId,
              modelRef: body.modelRef,
              role: body.role ?? null,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "model.allowlist_set",
              resourceType: "model_allowlist",
              resourceId: row.id,
              meta: { modelRef: body.modelRef, role: body.role },
            });
            return Response.json({ allowlist: row });
          }
          if (
            body.action === "create" &&
            body.providerKind &&
            body.modelId &&
            body.modelRef
          ) {
            const row = await providerRepo.createModel(db, {
              orgId: ctx.orgId,
              connectionId: body.connectionId,
              providerKind: body.providerKind,
              modelId: body.modelId,
              displayName: body.displayName ?? body.modelId,
              modelRef: body.modelRef,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "model.created",
              resourceType: "model",
              resourceId: row.id,
            });
            return Response.json({ model: row });
          }
          return Response.json({ error: "invalid action" }, { status: 400 });
        } catch (err) {
          if (isAppError(err) || err instanceof AppError) {
            return Response.json(
              { error: err.message, code: err.code },
              { status: err.status },
            );
          }
          return Response.json({ error: "Failed" }, { status: 500 });
        }
      },
    },
  },
});
