import { createFileRoute } from "@tanstack/react-router";
import { loginWithPassword } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { assertRateLimit, createLimiter } from "@maximus/rate-limit";
import { serverEnv } from "#/server/env";
import { sessionCookieHeader } from "#/server/cookies";
import { guardMutation, jsonError, jsonOk } from "#/server/api";
import { clientIpFromRequest } from "#/server/proxy";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ip = clientIpFromRequest(request);
          // IP-based login throttle when TRUST_PROXY provides an IP
          if (ip && env.valkeyUrl) {
            const limiter = createLimiter(env.valkeyUrl);
            try {
              await assertRateLimit(
                limiter,
                { ip },
                {
                  failOpen: env.rateLimitFailOpen,
                  ipPerMin: Number(process.env.RATE_LIMIT_LOGIN_IP_PER_MIN ?? 20),
                  userPerMin: 99999,
                  orgPerMin: 99999,
                },
              );
            } finally {
              await limiter.close();
            }
          }
          const body = (await request.json()) as {
            email?: string;
            password?: string;
          };
          if (!body.email || !body.password) {
            throw new AppError("VALIDATION", "email and password required");
          }
          const result = await loginWithPassword(
            {
              email: body.email,
              password: body.password,
              ipAddress: ip,
              userAgent: request.headers.get("user-agent"),
            },
            db,
          );
          return jsonOk(
            {
              ok: true,
              userId: result.userId,
              orgId: result.orgId,
              /** For non-browser API clients (also set as HttpOnly cookie). */
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
