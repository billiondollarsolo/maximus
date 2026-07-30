import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { createDb, providerRepo } from "@maximus/db";
import {
  defaultPlatformCatalog,
  modelsForUser,
  type CatalogModel,
} from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const orgModels = await providerRepo.listModels(db, ctx.orgId);
          const catalog: CatalogModel[] =
            orgModels.length > 0
              ? orgModels.map((m) => ({
                  modelRef: m.modelRef,
                  displayName: m.displayName,
                  providerKind: m.providerKind,
                  isEnabled: m.isEnabled,
                  capabilities: (m.capabilities ?? {}) as Record<
                    string,
                    unknown
                  >,
                }))
              : defaultPlatformCatalog();
          const allowRows = await providerRepo.listAllowlist(db, ctx.orgId);
          const allowlist = allowRows.map((r) => ({
            modelRef: r.modelRef,
            role: (r.role as "owner" | "admin" | "member" | null) ?? null,
          }));
          const models = modelsForUser(catalog, ctx.role, allowlist);
          return jsonOk({ models });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
