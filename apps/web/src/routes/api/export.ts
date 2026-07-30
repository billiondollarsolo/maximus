import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { getDb, exportConversation } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError, jsonOk } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          const format = (url.searchParams.get("format") ?? "md") as
            | "md"
            | "json";
          if (!id) {
            throw new AppError("VALIDATION", "id required");
          }
          const result = await exportConversation(
            db,
            {
              userId: ctx.user.id,
              orgId: ctx.orgId,
              role: ctx.role,
            },
            { id, format },
          );
          if (result.format === "json") {
            return jsonOk(result.body);
          }
          return withSecurityHeaders(
            new Response(result.body, {
              headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Content-Disposition": `attachment; filename="${id}.md"`,
              },
            }),
          );
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
