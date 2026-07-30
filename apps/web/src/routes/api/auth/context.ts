import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, switchActiveContext } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { serverEnv } from "#/server/env";
import { sessionFromRequest } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/auth/context")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const token = sessionFromRequest(request);
          const ctx = await requireAuth(token, db);
          const body = (await request.json()) as {
            orgId?: string;
            teamId?: string | null;
          };
          if (!body.orgId || typeof body.orgId !== "string") {
            throw new AppError("VALIDATION", "orgId required");
          }
          const next = await switchActiveContext(db, {
            sessionToken: ctx.sessionToken,
            userId: ctx.user.id,
            orgId: body.orgId,
          });
          // teamId accepted for future prefs; grants match all user teams regardless.
          return jsonOk({
            orgId: next.orgId,
            role: next.role,
            teamId: body.teamId ?? null,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
