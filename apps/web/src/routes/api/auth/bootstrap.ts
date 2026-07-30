import { createFileRoute } from "@tanstack/react-router";
import { bootstrapOwner } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { serverEnv } from "#/server/env";
import { sessionCookieHeader } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/auth/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const body = (await request.json()) as {
            email?: string;
            password?: string;
            name?: string;
            orgName?: string;
          };
          const email = body.email ?? process.env.BOOTSTRAP_EMAIL;
          const password = body.password ?? process.env.BOOTSTRAP_PASSWORD;
          if (!email || !password) {
            throw new AppError("VALIDATION", "email and password required");
          }
          const result = await bootstrapOwner(
            {
              email,
              password,
              name: body.name,
              orgName: body.orgName,
            },
            db,
          );
          return jsonOk(
            {
              ok: true,
              userId: result.userId,
              orgId: result.orgId,
              sessionToken: result.sessionToken,
            },
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
