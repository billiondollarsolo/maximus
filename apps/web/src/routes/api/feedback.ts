import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import {
  createDb,
  feedbackRepo,
  messageRepo,
  conversationRepo,
} from "@maximus/db";
import {
  AppError,
  canWriteConversation,
  isAppError,
} from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            messageId?: string;
            rating?: "up" | "down";
          };
          if (!body.messageId || (body.rating !== "up" && body.rating !== "down")) {
            return Response.json({ error: "invalid body" }, { status: 400 });
          }
          const msg = await messageRepo.getMessage(db, body.messageId);
          if (!msg) throw new AppError("NOT_FOUND", "Message not found");
          const conv = await conversationRepo.getConversation(
            db,
            msg.conversationId,
          );
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
            throw new AppError("NOT_FOUND", "Message not found");
          }
          const row = await feedbackRepo.upsertFeedback(db, {
            messageId: body.messageId,
            userId: ctx.user.id,
            rating: body.rating,
          });
          return Response.json({ feedback: row });
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
