import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, providerRepo, usageRepo } from "@maximus/db";
import {
  AppError,
  isAppError,
  serializeModelRef,
  type ProviderKind,
} from "@maximus/domain";
import { encryptSecret } from "@maximus/provider-gateway";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/admin/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const connections = await providerRepo.listProviderConnections(
            db,
            ctx.orgId,
          );
          return Response.json({
            connections: connections.map((c) => ({
              id: c.id,
              kind: c.kind,
              name: c.name,
              baseUrl: c.baseUrl,
              isEnabled: c.isEnabled,
              hasCredentials: Boolean(c.credentialsEncrypted),
            })),
          });
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
          if (!env.encryptionKey) {
            return Response.json(
              { error: "ENCRYPTION_KEY required for BYOK" },
              { status: 500 },
            );
          }
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            kind: ProviderKind;
            name: string;
            baseUrl?: string;
            apiKey: string;
            modelId?: string;
            displayName?: string;
          };
          const encrypted = encryptSecret(body.apiKey, env.encryptionKey);
          const conn = await providerRepo.createProviderConnection(db, {
            orgId: ctx.orgId,
            kind: body.kind,
            name: body.name,
            baseUrl: body.baseUrl,
            credentialsEncrypted: encrypted,
            createdBy: ctx.user.id,
          });
          if (body.modelId) {
            const modelRef = serializeModelRef({
              providerKind: body.kind,
              connectionId: conn.id,
              modelId: body.modelId,
            });
            await providerRepo.createModel(db, {
              orgId: ctx.orgId,
              connectionId: conn.id,
              providerKind: body.kind,
              modelId: body.modelId,
              displayName: body.displayName ?? body.modelId,
              modelRef,
            });
          }
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "provider.created",
            resourceType: "provider_connection",
            resourceId: conn.id,
            meta: { kind: body.kind, name: body.name },
          });
          return Response.json({
            connection: {
              id: conn.id,
              kind: conn.kind,
              name: conn.name,
              isPlaintext: conn.credentialsEncrypted === body.apiKey,
              cipherLen: conn.credentialsEncrypted.length,
            },
          });
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
