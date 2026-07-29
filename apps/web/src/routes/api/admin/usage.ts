import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, usageQueryRepo } from "@maximus/db";
import { AppError, isAppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/admin/usage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const usage = await usageQueryRepo.listUsage(db, { orgId: ctx.orgId });
          return Response.json({ usage });
        } catch (err) {
          if (isAppError(err) || err instanceof AppError) {
            return Response.json(
              { error: err.message, code: err.code },
              { status: err.status },
            );
          }
          return Response.json({ error: "Failed" }, { status: 500 });
        }
      },
    },
  },
});
