import { createFileRoute } from "@tanstack/react-router";
import { acceptInvite } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionCookieHeader } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/auth/invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const body = (await request.json()) as {
            inviteId?: string;
            password?: string;
            name?: string;
          };
          if (!body.inviteId || !body.password) {
            throw new AppError("VALIDATION", "inviteId and password required");
          }
          const result = await acceptInvite(
            {
              inviteId: body.inviteId,
              password: body.password,
              name: body.name,
            },
            db,
          );
          return jsonOk(
            { ok: true, userId: result.userId, orgId: result.orgId },
            {
              headers: {
                "Set-Cookie": sessionCookieHeader(result.sessionToken),
              },
            },
          );
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
