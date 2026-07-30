import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { deleteUserAccount, getDb, usageRepo } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest, clearSessionCookieHeader } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

/**
 * Hard-delete the signed-in user account.
 * Requires confirm: "DELETE". Cannot leave an org without an owner.
 */
export const Route = createFileRoute("/api/auth/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as { confirm?: string };
          if (body.confirm !== "DELETE") {
            throw new AppError(
              "VALIDATION",
              'Account deletion requires confirm: "DELETE"',
            );
          }

          try {
            const result = await deleteUserAccount(db, {
              userId: ctx.user.id,
              orgId: ctx.orgId,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: result.orgDeleted ? null : ctx.orgId,
              actorUserId: null,
              action: "account.deleted",
              resourceType: "user",
              resourceId: ctx.user.id,
              meta: { orgDeleted: result.orgDeleted },
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Delete failed";
            if (msg.includes("Transfer ownership")) {
              throw new AppError("VALIDATION", msg);
            }
            throw e;
          }

          return jsonOk(
            { deleted: true },
            {
              headers: {
                "Set-Cookie": clearSessionCookieHeader(),
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
