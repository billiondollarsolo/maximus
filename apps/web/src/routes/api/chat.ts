import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { createDb, getOrgRateLimitFailOpen, runChatTurn } from "@maximus/db";
import { isAppError } from "@maximus/domain";
import { assertRateLimit, createLimiter } from "@maximus/rate-limit";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = serverEnv();
        const db = createDb(env.databaseUrl);
        const abortController = new AbortController();
        request.signal.addEventListener("abort", () => abortController.abort());

        try {
          guardMutation(request);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          // D16: fail-closed by default; org.settings.rateLimitFailOpen may open
          const orgFailOpen = await getOrgRateLimitFailOpen(db, ctx.orgId);
          const failOpen = env.rateLimitFailOpen || orgFailOpen;

          const limiter = createLimiter(env.valkeyUrl);
          try {
            await assertRateLimit(
              limiter,
              { userId: ctx.user.id, orgId: ctx.orgId },
              {
                userPerMin: env.userPerMin,
                orgPerMin: env.orgPerMin,
                failOpen,
              },
            );
          } finally {
            await limiter.close();
          }

          const body = (await request.json()) as {
            input?: { text?: string; attachmentIds?: string[] };
            text?: string;
            forwardedProps?: {
              conversationId?: string;
              modelRef?: string;
              projectId?: string;
              mode?: "send" | "regenerate" | "edit";
              targetMessageId?: string;
            };
            messages?: unknown;
          };

          const text = body.input?.text ?? body.text ?? "";
          const modelRef =
            body.forwardedProps?.modelRef ?? "openai:platform:gpt-4.1";

          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              const send = (obj: unknown) => {
                controller.enqueue(
                  enc.encode(`data: ${JSON.stringify(obj)}\n\n`),
                );
              };
              try {
                for await (const ev of runChatTurn({
                  db,
                  ctx,
                  body: {
                    text,
                    attachmentIds: body.input?.attachmentIds,
                    conversationId: body.forwardedProps?.conversationId,
                    modelRef,
                    projectId: body.forwardedProps?.projectId,
                    mode: body.forwardedProps?.mode,
                    targetMessageId: body.forwardedProps?.targetMessageId,
                    clientMessages: body.messages,
                  },
                  providerMode: env.providerMode,
                  platform: {
                    openaiApiKey: env.openaiApiKey,
                    anthropicApiKey: env.anthropicApiKey,
                    ollamaBaseUrl: env.ollamaBaseUrl,
                  },
                  allowPrivateBaseUrls: env.allowPrivateBaseUrls,
                  encryptionKey: env.encryptionKey,
                  signal: abortController.signal,
                })) {
                  send(ev);
                }
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "chat failed";
                const code = isAppError(err) ? err.code : "PROVIDER_ERROR";
                send({ type: "error", message, code });
              } finally {
                controller.close();
              }
            },
          });

          return withSecurityHeaders(
            new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
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
