import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { conversationRepo, createDb, messageRepo } from "@maximus/db";
import {
  AppError,
  canWriteConversation,
} from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

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
            // Full tree so client can switch branches (WP42)
            const msgs = await messageRepo.listMessagesForConversation(db, id);
            return jsonOk({
              conversation: conv,
              messages: msgs,
              activeLeafId: conv.activeLeafId,
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
          return jsonOk({ conversations: items });
        } catch (err) {
          return jsonError(err);
        }
      },
      PATCH: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            id: string;
            title?: string;
            archive?: boolean;
            activeLeafId?: string | null;
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
          if (body.activeLeafId) {
            const msgs = await messageRepo.listMessagesForConversation(
              db,
              body.id,
            );
            if (!msgs.some((m) => m.id === body.activeLeafId)) {
              throw new AppError("VALIDATION", "activeLeafId not in conversation");
            }
          }
          const updated = await conversationRepo.updateConversation(db, body.id, {
            title: body.title,
            titleSource: body.title != null ? "user" : undefined,
            archivedAt: body.archive ? new Date() : undefined,
            activeLeafId:
              body.activeLeafId !== undefined ? body.activeLeafId : undefined,
          });
          return jsonOk({ conversation: updated });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
