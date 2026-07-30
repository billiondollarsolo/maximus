import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, providerRepo, usageRepo } from "@maximus/db";
import {
  AppError,
  serializeModelRef,
  validateProviderConnection,
  type ProviderKind,
} from "@maximus/domain";
import {
  assertSafeBaseUrl,
  decryptSecret,
  encryptSecret,
  testProviderConnection,
} from "@maximus/provider-gateway";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

function requireEncryptionKey(key: string | undefined): string {
  if (!key) {
    throw new AppError(
      "VALIDATION",
      "ENCRYPTION_KEY required for BYOK",
      500,
    );
  }
  return key;
}

/** SSRF-check optional baseUrl; strip trailing slash; null if empty. */
function safePersistBaseUrl(
  baseUrl: string | null | undefined,
  allowPrivate: boolean,
): string | null {
  if (baseUrl == null || baseUrl.trim() === "") return null;
  const raw = baseUrl.trim().replace(/\/+$/, "");
  try {
    assertSafeBaseUrl(raw, { allowPrivate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid base URL";
    throw new AppError("VALIDATION", msg);
  }
  return raw;
}

function safeConnection(
  c: {
    id: string;
    kind: string;
    name: string;
    baseUrl: string | null;
    isEnabled: boolean;
    credentialsEncrypted: string;
    credentialsMeta?: Record<string, unknown> | null;
  },
  modelCount = 0,
) {
  const meta = c.credentialsMeta ?? {};
  const hasCredentials =
    typeof meta.hasSecret === "boolean"
      ? meta.hasSecret
      : Boolean(c.credentialsEncrypted);
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    baseUrl: c.baseUrl,
    isEnabled: c.isEnabled,
    hasCredentials,
    modelCount,
  };
}

export const Route = createFileRoute("/api/admin/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const connections = await providerRepo.listProviderConnections(
            db,
            ctx.orgId,
          );
          const withModels = await Promise.all(
            connections.map(async (c) => {
              const modelRows = await providerRepo.listModelsForConnection(
                db,
                c.id,
              );
              return {
                ...safeConnection(c, modelRows.length),
                models: modelRows.map((m) => ({
                  id: m.id,
                  modelRef: m.modelRef,
                  modelId: m.modelId,
                  displayName: m.displayName,
                  isEnabled: m.isEnabled,
                  capabilities: m.capabilities,
                  sortOrder: m.sortOrder,
                  inputUsdPer1m:
                    m.inputUsdPer1m == null
                      ? null
                      : Number(m.inputUsdPer1m),
                  outputUsdPer1m:
                    m.outputUsdPer1m == null
                      ? null
                      : Number(m.outputUsdPer1m),
                })),
              };
            }),
          );
          return jsonOk({ connections: withModels });
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
            action?: "rotate" | "test" | "create";
            id?: string;
            kind?: ProviderKind;
            name?: string;
            baseUrl?: string;
            apiKey?: string;
            models?: Array<{
              modelId: string;
              displayName?: string;
              capabilities?: Record<string, unknown>;
              sortOrder?: number;
              inputUsdPer1m?: number | null;
              outputUsdPer1m?: number | null;
            }>;
            modelId?: string;
            displayName?: string;
            inputUsdPer1m?: number | null;
            outputUsdPer1m?: number | null;
          };

          if (body.action === "rotate" && body.id && body.apiKey != null) {
            const encKey = requireEncryptionKey(env.encryptionKey);
            const existing = await providerRepo.getProviderConnectionForOrg(
              db,
              ctx.orgId,
              body.id,
            );
            if (!existing) throw new AppError("NOT_FOUND", "Connection not found");
            const encrypted = encryptSecret(body.apiKey, encKey);
            const row = await providerRepo.rotateProviderCredentials(db, {
              id: body.id,
              orgId: ctx.orgId,
              credentialsEncrypted: encrypted,
              hasSecret: body.apiKey.trim().length > 0,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "provider.rotated",
              resourceType: "provider_connection",
              resourceId: body.id,
            });
            return jsonOk({
              connection: safeConnection(row!, 0),
            });
          }

          if (body.action === "test") {
            let kind: ProviderKind;
            let baseUrl: string | null | undefined;
            let apiKey: string | undefined;

            if (body.id) {
              const encKey = requireEncryptionKey(env.encryptionKey);
              const existing = await providerRepo.getProviderConnectionForOrg(
                db,
                ctx.orgId,
                body.id,
              );
              if (!existing) throw new AppError("NOT_FOUND", "Connection not found");
              kind = existing.kind as ProviderKind;
              baseUrl = existing.baseUrl;
              apiKey = decryptSecret(existing.credentialsEncrypted, encKey);
            } else {
              if (!body.kind) {
                throw new AppError("VALIDATION", "kind required for unsaved test");
              }
              kind = body.kind;
              baseUrl = body.baseUrl;
              apiKey = body.apiKey;
            }

            const result = await testProviderConnection({
              kind,
              baseUrl,
              apiKey,
              allowPrivateBaseUrls: env.allowPrivateBaseUrls,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "provider.tested",
              resourceType: "provider_connection",
              resourceId: body.id ?? null,
              meta: {
                ok: result.ok,
                latencyMs: result.latencyMs,
                errorCode: result.errorCode,
              },
            });
            return jsonOk({ result });
          }

          // create
          const encKey = requireEncryptionKey(env.encryptionKey);
          if (!body.kind || !body.name) {
            throw new AppError("VALIDATION", "kind and name required");
          }
          const validated = validateProviderConnection({
            kind: body.kind,
            apiKey: body.apiKey,
            baseUrl: body.baseUrl,
          });
          if (!validated.ok) {
            throw new AppError("VALIDATION", validated.error);
          }
          const baseUrl = safePersistBaseUrl(
            validated.baseUrl,
            env.allowPrivateBaseUrls,
          );
          const encrypted = encryptSecret(validated.apiKey, encKey);
          const conn = await providerRepo.createProviderConnection(db, {
            orgId: ctx.orgId,
            kind: validated.kind,
            name: body.name,
            baseUrl,
            credentialsEncrypted: encrypted,
            hasSecret: validated.apiKey.length > 0,
            createdBy: ctx.user.id,
          });

          const modelInputs =
            body.models ??
            (body.modelId
              ? [
                  {
                    modelId: body.modelId,
                    displayName: body.displayName,
                    inputUsdPer1m: body.inputUsdPer1m,
                    outputUsdPer1m: body.outputUsdPer1m,
                  },
                ]
              : []);

          const createdModels = [];
          for (const m of modelInputs) {
            const modelRef = serializeModelRef({
              providerKind: validated.kind,
              connectionId: conn.id,
              modelId: m.modelId,
            });
            const row = await providerRepo.createModel(db, {
              orgId: ctx.orgId,
              connectionId: conn.id,
              providerKind: validated.kind,
              modelId: m.modelId,
              displayName: m.displayName ?? m.modelId,
              modelRef,
              capabilities: m.capabilities,
              sortOrder: m.sortOrder,
              inputUsdPer1m: m.inputUsdPer1m,
              outputUsdPer1m: m.outputUsdPer1m,
            });
            createdModels.push(row);
          }

          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "provider.created",
            resourceType: "provider_connection",
            resourceId: conn.id,
            meta: { kind: validated.kind, name: body.name },
          });

          return jsonOk({
            connection: safeConnection(conn, createdModels.length),
            models: createdModels.map((m) => ({
              id: m.id,
              modelRef: m.modelRef,
              displayName: m.displayName,
            })),
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
            id?: string;
            name?: string;
            baseUrl?: string | null;
            isEnabled?: boolean;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const baseUrl =
            body.baseUrl === undefined
              ? undefined
              : safePersistBaseUrl(body.baseUrl, env.allowPrivateBaseUrls);
          const row = await providerRepo.updateProviderConnection(db, {
            id: body.id,
            orgId: ctx.orgId,
            name: body.name,
            baseUrl,
            isEnabled: body.isEnabled,
          });
          if (!row) throw new AppError("NOT_FOUND", "Connection not found");
          const action =
            body.isEnabled === false
              ? "provider.disabled"
              : body.isEnabled === true
                ? "provider.enabled"
                : "provider.updated";
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action,
            resourceType: "provider_connection",
            resourceId: row.id,
            meta: {
              name: body.name,
              baseUrl,
              isEnabled: body.isEnabled,
            },
          });
          const modelCount = await providerRepo.countModelsForConnection(
            db,
            row.id,
          );
          return jsonOk({ connection: safeConnection(row, modelCount) });
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
          const existing = await providerRepo.getProviderConnectionForOrg(
            db,
            ctx.orgId,
            body.id,
          );
          if (!existing) throw new AppError("NOT_FOUND", "Connection not found");
          const result = await providerRepo.deleteProviderConnection(db, {
            id: body.id,
            orgId: ctx.orgId,
          });
          if (!result.ok) {
            if (result.reason === "models_exist") {
              throw new AppError(
                "VALIDATION",
                `Cannot delete connection with ${result.modelCount} model(s); remove models or disable the connection`,
              );
            }
            throw new AppError("NOT_FOUND", "Connection not found");
          }
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "provider.deleted",
            resourceType: "provider_connection",
            resourceId: body.id,
            meta: { kind: existing.kind, name: existing.name },
          });
          return jsonOk({ deleted: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
