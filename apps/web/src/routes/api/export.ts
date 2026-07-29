import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { conversationRepo, createDb, messageRepo } from "@maximus/db";
import {
  AppError,
  canWriteConversation,
  isAppError,
  textFromParts,
  type ContentPart,
} from "@maximus/domain";
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
          const format = url.searchParams.get("format") ?? "md";
          if (!id) {
            return Response.json({ error: "id required" }, { status: 400 });
          }
          const conv = await conversationRepo.getConversation(db, id);
          if (
            !conv ||
            !canWriteConversation({
              conversationOrgId: conv.orgId,
              conversationUserId: conv.userId,
              actorOrgId: ctx.orgId,
              actorUserId: ctx.user.id,
              actorRole: ctx.role,
            })
          ) {
            throw new AppError("NOT_FOUND", "Conversation not found");
          }
          const msgs = await messageRepo.listMessagesForConversation(db, id);
          if (format === "json") {
            return Response.json({ conversation: conv, messages: msgs });
          }
          const md = [
            `# ${conv.title ?? "Conversation"}`,
            "",
            ...msgs.map((m) => {
              const text = textFromParts((m.content as ContentPart[]) ?? []);
              return `## ${m.role}\n\n${text}\n`;
            }),
          ].join("\n");
          return new Response(md, {
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
