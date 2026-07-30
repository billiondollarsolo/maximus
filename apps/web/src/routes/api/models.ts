import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";
import { buildModelCatalog } from "#/server/build-model-catalog";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const { models, platform, agents, defaultModelRef } =
            await buildModelCatalog({
              db,
              orgId: ctx.orgId,
              role: ctx.role,
              env,
            });
          // Picker options: base offerings + agent presets (agent:{id}).
          const pickerModels = [
            ...agents.map((a) => ({
              modelRef: a.modelRef,
              displayName: a.displayName,
              providerKind: "agent",
              connectionName: "Agents",
              capabilities: {},
            })),
            ...models,
          ];
          return jsonOk({
            models: pickerModels,
            platform,
            agents,
            defaultModelRef,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
