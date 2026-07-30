import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { getDb, userSettingsRepo } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

/**
 * User personalization (custom instructions) for the active org.
 * Wired into chat system prompts via assembleSystemPrompts.
 */
export const Route = createFileRoute("/api/me/instructions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const row = await userSettingsRepo.getCustomInstructions(db, {
            userId: ctx.user.id,
            orgId: ctx.orgId,
          });
          return jsonOk({
            instructions: {
              aboutUser: row?.aboutUser ?? "",
              preferredResponse: row?.preferredResponse ?? "",
              updatedAt: row?.updatedAt?.toISOString() ?? null,
            },
          });
        } catch (err) {
          return jsonError(err);
        }
      },
      PUT: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            aboutUser?: string | null;
            preferredResponse?: string | null;
          };
          const row = await userSettingsRepo.upsertCustomInstructions(db, {
            userId: ctx.user.id,
            orgId: ctx.orgId,
            aboutUser:
              body.aboutUser === undefined
                ? undefined
                : body.aboutUser?.trim() || null,
            preferredResponse:
              body.preferredResponse === undefined
                ? undefined
                : body.preferredResponse?.trim() || null,
          });
          return jsonOk({
            instructions: {
              aboutUser: row.aboutUser ?? "",
              preferredResponse: row.preferredResponse ?? "",
              updatedAt: row.updatedAt.toISOString(),
            },
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
