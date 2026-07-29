import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { conversationRepo, createDb, messageRepo } from "@maximus/db";
import {
  AppError,
  canWriteConversation,
  isAppError,
  listActiveBranch,
  type TreeMessage,
} from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (id) {
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
            const tree: TreeMessage[] = msgs.map((m) => ({
              id: m.id,
              parentMessageId: m.parentMessageId,
              role: m.role as TreeMessage["role"],
              position: m.position,
            }));
            const active = listActiveBranch(tree, conv.activeLeafId);
            const activeIds = new Set(active.map((m) => m.id));
            return Response.json({
              conversation: conv,
              messages: msgs.filter((m) => activeIds.has(m.id)),
            });
          }
          const q = url.searchParams.get("q");
          const items = q
            ? await conversationRepo.searchConversations(db, {
                orgId: ctx.orgId,
                userId: ctx.user.id,
                query: q,
              })
            : await conversationRepo.listConversations(db, {
                orgId: ctx.orgId,
                userId: ctx.user.id,
              });
          return Response.json({ conversations: items });
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
      PATCH: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            id: string;
            title?: string;
            archive?: boolean;
          };
          const conv = await conversationRepo.getConversation(db, body.id);
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
          const updated = await conversationRepo.updateConversation(db, body.id, {
            title: body.title,
            titleSource: body.title != null ? "user" : undefined,
            archivedAt: body.archive ? new Date() : undefined,
          });
          return Response.json({ conversation: updated });
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
