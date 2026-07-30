import { createFileRoute } from "@tanstack/react-router";
import { loginWithPassword } from "@maximus/auth";
import { createDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { serverEnv } from "#/server/env";
import { sessionCookieHeader } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const body = (await request.json()) as {
            email?: string;
            password?: string;
          };
          if (!body.email || !body.password) {
            throw new AppError("VALIDATION", "email and password required");
          }
          const result = await loginWithPassword(
            { email: body.email, password: body.password },
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
