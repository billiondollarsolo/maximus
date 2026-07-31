import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { conversationRepo, getDb, messageRepo } from "@maximus/db";
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
          const db = getDb(env.databaseUrl);
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
            let msgs = await messageRepo.listMessagesForConversation(db, id);
            // Heal orphaned "streaming" rows (client navigated away / proxy drop).
            // Live turns update within seconds; anything older than 3m is stuck.
            const staleMs = 3 * 60 * 1000;
            const now = Date.now();
            for (const m of msgs) {
              if (m.status !== "streaming" || m.role !== "assistant") continue;
              const age = now - new Date(m.updatedAt ?? m.createdAt).getTime();
              if (age < staleMs) continue;
              await messageRepo.updateMessage(db, m.id, {
                status: "error",
                content: [
                  {
                    type: "text",
                    text:
                      "(Generation interrupted. Stop and resend, or pick a smaller model.)",
                  },
                ],
                error: { code: "ABORTED", message: "stale streaming message" },
              });
            }
            msgs = await messageRepo.listMessagesForConversation(db, id);
            return jsonOk({
              conversation: conv,
              messages: msgs,
              activeLeafId: conv.activeLeafId,
            });
          }
          const scopeParam = url.searchParams.get("scope");
          const scope =
            scopeParam === "archived" || scopeParam === "all"
              ? scopeParam
              : "active";
          const projectId = url.searchParams.get("projectId");
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
                scope,
                projectId: projectId || undefined,
              });
          return jsonOk({ conversations: items, scope });
        } catch (err) {
          return jsonError(err);
        }
      },
      PATCH: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            id: string;
            title?: string;
            /** true = archive, false = unarchive */
            archive?: boolean;
            activeLeafId?: string | null;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
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
              throw new AppError(
                "VALIDATION",
                "activeLeafId not in conversation",
              );
            }
          }

          const patch: {
            title?: string | null;
            titleSource?: string | null;
            archivedAt?: Date | null;
            activeLeafId?: string | null;
          } = {};
          if (body.title !== undefined) {
            patch.title = body.title.trim() || null;
            patch.titleSource = "user";
          }
          if (body.archive === true) patch.archivedAt = new Date();
          if (body.archive === false) patch.archivedAt = null;
          if (body.activeLeafId !== undefined) {
            patch.activeLeafId = body.activeLeafId;
          }

          const updated = await conversationRepo.updateConversation(
            db,
            body.id,
            patch,
          );
          return jsonOk({ conversation: updated });
        } catch (err) {
          return jsonError(err);
        }
      },
      DELETE: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            id?: string;
            /** bulk: all | archived */
            bulk?: "all" | "archived";
            /** type DELETE to confirm bulk wipe */
            confirm?: string;
          };

          if (body.bulk) {
            if (body.confirm !== "DELETE") {
              throw new AppError(
                "VALIDATION",
                'Bulk delete requires confirm: "DELETE"',
              );
            }
            const result = await conversationRepo.deleteConversationsForUser(
              db,
              {
                orgId: ctx.orgId,
                userId: ctx.user.id,
                archivedOnly: body.bulk === "archived",
              },
            );
            return jsonOk({ deleted: result.deleted, bulk: body.bulk });
          }

          if (!body.id) throw new AppError("VALIDATION", "id required");
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
          await conversationRepo.deleteConversation(db, body.id);
          return jsonOk({ deleted: true, id: body.id });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
