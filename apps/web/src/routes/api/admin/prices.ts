import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, pricesRepo, usageRepo } from "@maximus/db";
import { AppError, isProviderKind } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

function mapPrice(row: {
  id: string;
  orgId: string | null;
  providerKind: string;
  modelIdPattern: string;
  inputUsdPer1m: string;
  outputUsdPer1m: string;
  currency: string;
}) {
  return {
    id: row.id,
    orgId: row.orgId,
    providerKind: row.providerKind,
    modelIdPattern: row.modelIdPattern,
    inputUsdPer1m: Number(row.inputUsdPer1m),
    outputUsdPer1m: Number(row.outputUsdPer1m),
    currency: row.currency,
    readOnly: row.orgId == null,
  };
}

export const Route = createFileRoute("/api/admin/prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const rows = await pricesRepo.listPrices(db, ctx.orgId);
          return jsonOk({ prices: rows.map(mapPrice) });
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
            providerKind?: string;
            modelIdPattern?: string;
            inputUsdPer1m?: number;
            outputUsdPer1m?: number;
          };
          if (
            !body.providerKind ||
            !isProviderKind(body.providerKind) ||
            !body.modelIdPattern ||
            body.inputUsdPer1m == null ||
            body.outputUsdPer1m == null
          ) {
            throw new AppError(
              "VALIDATION",
              "providerKind, modelIdPattern, inputUsdPer1m, outputUsdPer1m required",
            );
          }
          if (body.inputUsdPer1m < 0 || body.outputUsdPer1m < 0) {
            throw new AppError("VALIDATION", "prices must be >= 0");
          }
          const row = await pricesRepo.createOrgPrice(db, {
            orgId: ctx.orgId,
            providerKind: body.providerKind,
            modelIdPattern: body.modelIdPattern,
            inputUsdPer1m: body.inputUsdPer1m,
            outputUsdPer1m: body.outputUsdPer1m,
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "price.created",
            resourceType: "model_price",
            resourceId: row.id,
            meta: {
              providerKind: body.providerKind,
              pattern: body.modelIdPattern,
              inputUsdPer1m: body.inputUsdPer1m,
              outputUsdPer1m: body.outputUsdPer1m,
            },
          });
          return jsonOk({ price: mapPrice(row) });
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
            modelIdPattern?: string;
            inputUsdPer1m?: number;
            outputUsdPer1m?: number;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const any = await pricesRepo.getPriceById(db, body.id);
          if (any && any.orgId == null) {
            throw new AppError(
              "FORBIDDEN",
              "Platform price seeds are read-only",
            );
          }
          const row = await pricesRepo.updateOrgPrice(db, {
            id: body.id,
            orgId: ctx.orgId,
            modelIdPattern: body.modelIdPattern,
            inputUsdPer1m: body.inputUsdPer1m,
            outputUsdPer1m: body.outputUsdPer1m,
          });
          if (!row) throw new AppError("NOT_FOUND", "Price not found");
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "price.updated",
            resourceType: "model_price",
            resourceId: row.id,
            meta: {
              pattern: body.modelIdPattern,
              inputUsdPer1m: body.inputUsdPer1m,
              outputUsdPer1m: body.outputUsdPer1m,
            },
          });
          return jsonOk({ price: mapPrice(row) });
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
          const any = await pricesRepo.getPriceById(db, body.id);
          if (any && any.orgId == null) {
            throw new AppError(
              "FORBIDDEN",
              "Platform price seeds are read-only",
            );
          }
          const row = await pricesRepo.deleteOrgPrice(db, {
            id: body.id,
            orgId: ctx.orgId,
          });
          if (!row) throw new AppError("NOT_FOUND", "Price not found");
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "price.deleted",
            resourceType: "model_price",
            resourceId: body.id,
            meta: {
              providerKind: row.providerKind,
              pattern: row.modelIdPattern,
            },
          });
          return jsonOk({ deleted: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
