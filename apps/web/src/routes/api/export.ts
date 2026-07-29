import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { createDb, exportConversation } from "@maximus/db";
import { AppError, isAppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          const format = (url.searchParams.get("format") ?? "md") as
            | "md"
            | "json";
          if (!id) {
            return Response.json({ error: "id required" }, { status: 400 });
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
            return Response.json(result.body);
          }
          return new Response(result.body, {
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Content-Disposition": `attachment; filename="${id}.md"`,
            },
          });
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
