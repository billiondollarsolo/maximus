import { createFileRoute } from "@tanstack/react-router";
import { bootstrapOwner } from "@maximus/auth";
import { createDb } from "@maximus/db";
import { AppError, isAppError } from "@maximus/domain";
import { serverEnv } from "#/server/env";
import { sessionCookieHeader } from "#/server/cookies";

export const Route = createFileRoute("/api/auth/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const body = (await request.json()) as {
            email?: string;
            password?: string;
            name?: string;
            orgName?: string;
          };
          const email = body.email ?? process.env.BOOTSTRAP_EMAIL;
          const password = body.password ?? process.env.BOOTSTRAP_PASSWORD;
          if (!email || !password) {
            return Response.json(
              { error: "email and password required" },
              { status: 400 },
            );
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
          return Response.json(
            { ok: true, userId: result.userId, orgId: result.orgId },
            {
              headers: {
                "Set-Cookie": sessionCookieHeader(result.sessionToken),
              },
            },
          );
        } catch (err) {
          if (isAppError(err) || err instanceof AppError) {
            return Response.json(
              { error: err.message, code: err.code },
              { status: err.status },
            );
          }
          return Response.json({ error: "Bootstrap failed" }, { status: 500 });
        }
      },
    },
  },
});
