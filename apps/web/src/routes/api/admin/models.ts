import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, providerRepo, usageRepo } from "@maximus/db";
import {
  AppError,
  isModelRef,
  serializeModelRef,
  type ProviderKind,
} from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";
import { buildModelCatalog } from "#/server/build-model-catalog";

export const Route = createFileRoute("/api/admin/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const [models, allowlist, connections, composed] = await Promise.all([
            providerRepo.listModels(db, ctx.orgId),
            providerRepo.listAllowlist(db, ctx.orgId),
            providerRepo.listProviderConnections(db, ctx.orgId),
            buildModelCatalog({
              db,
              orgId: ctx.orgId,
              role: ctx.role,
              env,
            }),
          ]);
          return jsonOk({
            models,
            allowlist,
            /** Gated platform + discovered Ollama (for Access UI). */
            platform: composed.platform,
            /** Full user-facing catalog (role + allowlist). */
            catalog: composed.models,
            connections: connections.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
              isEnabled: c.isEnabled,
              baseUrl: c.baseUrl,
            })),
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
            action?: "allowlist" | "allowlist_upsert" | "create";
            modelRef?: string;
            role?: string | null;
            providerKind?: string;
            modelId?: string;
            displayName?: string;
            connectionId?: string | null;
            capabilities?: Record<string, unknown>;
            sortOrder?: number;
            inputUsdPer1m?: number | null;
            outputUsdPer1m?: number | null;
          };

          if (
            (body.action === "allowlist" ||
              body.action === "allowlist_upsert") &&
            body.modelRef
          ) {
            if (!isModelRef(body.modelRef)) {
              throw new AppError("VALIDATION", "invalid modelRef");
            }
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
            return jsonOk({ allowlist: row });
          }

          if (body.action === "create" || (!body.action && body.modelId)) {
            if (!body.providerKind || !body.modelId) {
              throw new AppError(
                "VALIDATION",
                "providerKind and modelId required",
              );
            }
            let connectionId = body.connectionId ?? null;
            if (connectionId) {
              const conn = await providerRepo.getProviderConnectionForOrg(
                db,
                ctx.orgId,
                connectionId,
              );
              if (!conn) {
                throw new AppError("NOT_FOUND", "Connection not found");
              }
              if (conn.kind !== body.providerKind) {
                throw new AppError(
                  "VALIDATION",
                  "Connection kind mismatch",
                );
              }
            }
            const modelRef = serializeModelRef({
              providerKind: body.providerKind as ProviderKind,
              connectionId: connectionId ?? "platform",
              modelId: body.modelId,
            });
            try {
              const row = await providerRepo.createModel(db, {
                orgId: ctx.orgId,
                connectionId,
                providerKind: body.providerKind,
                modelId: body.modelId,
                displayName: body.displayName ?? body.modelId,
                modelRef,
                capabilities: body.capabilities,
                sortOrder: body.sortOrder,
                inputUsdPer1m: body.inputUsdPer1m,
                outputUsdPer1m: body.outputUsdPer1m,
              });
              await usageRepo.insertAuditEvent(db, {
                orgId: ctx.orgId,
                actorUserId: ctx.user.id,
                action: "model.created",
                resourceType: "model",
                resourceId: row.id,
                meta: { modelRef },
              });
              return jsonOk({ model: row });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "";
              if (msg.includes("unique") || msg.includes("duplicate")) {
                throw new AppError("VALIDATION", "modelRef already exists");
              }
              throw e;
            }
          }

          throw new AppError("VALIDATION", "invalid action");
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
            id?: string;
            displayName?: string;
            capabilities?: Record<string, unknown>;
            isEnabled?: boolean;
            isVisible?: boolean;
            sortOrder?: number;
            inputUsdPer1m?: number | null;
            outputUsdPer1m?: number | null;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const row = await providerRepo.updateModel(db, {
            id: body.id,
            orgId: ctx.orgId,
            displayName: body.displayName,
            capabilities: body.capabilities,
            isEnabled: body.isEnabled,
            isVisible: body.isVisible,
            sortOrder: body.sortOrder,
            inputUsdPer1m: body.inputUsdPer1m,
            outputUsdPer1m: body.outputUsdPer1m,
          });
          if (!row) throw new AppError("NOT_FOUND", "Model not found");
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "model.updated",
            resourceType: "model",
            resourceId: row.id,
            meta: {
              displayName: body.displayName,
              isEnabled: body.isEnabled,
              sortOrder: body.sortOrder,
              inputUsdPer1m: body.inputUsdPer1m,
              outputUsdPer1m: body.outputUsdPer1m,
            },
          });
          return jsonOk({ model: row });
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
          const body = (await request.json()) as {
            id?: string;
            action?: "allowlist_delete";
            modelRef?: string;
          };

          if (body.action === "allowlist_delete" && body.id) {
            const row = await providerRepo.deleteAllowlist(db, {
              id: body.id,
              orgId: ctx.orgId,
            });
            if (!row) throw new AppError("NOT_FOUND", "Allowlist rule not found");
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "model.allowlist_deleted",
              resourceType: "model_allowlist",
              resourceId: row.id,
              meta: { modelRef: row.modelRef, role: row.role },
            });
            return jsonOk({ deleted: true });
          }

          if (!body.id) throw new AppError("VALIDATION", "id required");
          const existing = await providerRepo.getModelForOrg(
            db,
            ctx.orgId,
            body.id,
          );
          if (!existing) throw new AppError("NOT_FOUND", "Model not found");
          await providerRepo.deleteModel(db, {
            id: body.id,
            orgId: ctx.orgId,
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "model.deleted",
            resourceType: "model",
            resourceId: body.id,
            meta: { modelRef: existing.modelRef },
          });
          return jsonOk({ deleted: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
