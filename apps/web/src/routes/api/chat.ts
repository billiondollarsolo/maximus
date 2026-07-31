import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { getDb, getOrgRateLimitFailOpen, runChatTurn } from "@maximus/db";
import { defaultPlatformModelRef, isAppError } from "@maximus/domain";
import { assertRateLimit, createLimiter } from "@maximus/rate-limit";
import { createStorageClient } from "@maximus/storage";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";
import { clientIpFromRequest } from "#/server/proxy";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = serverEnv();
        const db = getDb(env.databaseUrl);
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
              {
                userId: ctx.user.id,
                orgId: ctx.orgId,
                ip: clientIpFromRequest(request),
              },
              {
                userPerMin: env.userPerMin,
                orgPerMin: env.orgPerMin,
                ipPerMin: Number(process.env.RATE_LIMIT_IP_PER_MIN ?? 120),
                failOpen,
              },
            );
          } finally {
            await limiter.close();
          }

          const body = (await request.json()) as {
            input?: { text?: string; attachmentIds?: string[] };
            text?: string;
            /** Prefer forwardedProps.modelRef (SPA); top-level modelRef accepted too */
            modelRef?: string;
            forwardedProps?: {
              conversationId?: string;
              modelRef?: string;
              projectId?: string;
              mode?: "send" | "regenerate" | "edit";
              interactionMode?: "chat" | "image_gen";
              targetMessageId?: string;
            };
            messages?: unknown;
          };

          const text = body.input?.text ?? body.text ?? "";
          const modelRef =
            body.forwardedProps?.modelRef ??
            body.modelRef ??
            defaultPlatformModelRef({
              providerMode: env.providerMode,
              openai: Boolean(env.openaiApiKey),
              anthropic: Boolean(env.anthropicApiKey),
              ollamaBaseUrl: Boolean(env.ollamaBaseUrl),
            });
          const storage = createStorageClient(env.s3);

          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              const send = (obj: unknown) => {
                controller.enqueue(
                  enc.encode(`data: ${JSON.stringify(obj)}\n\n`),
                );
              };
              // Large local models (e.g. 31B) can sit 30–120s loading weights
              // before the first token. Without traffic, proxies/browsers drop
              // the SSE socket and the UI looks "stuck" / empty until refresh.
              const keepalive = setInterval(() => {
                try {
                  controller.enqueue(
                    enc.encode(`: keepalive ${Date.now()}\n\n`),
                  );
                  send({
                    type: "status",
                    phase: "waiting_for_model",
                    message:
                      "Waiting for the model (large models can take a while to load)…",
                  });
                } catch {
                  // stream already closed
                }
              }, 12_000);
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
                    interactionMode: body.forwardedProps?.interactionMode,
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
                  storage: {
                    getObjectBuffer: (key) => storage.getObjectBuffer(key),
                    putObjectBuffer: (key, body, ct) =>
                      storage.putObjectBuffer(key, body, ct),
                    attachmentKey: (orgId, id) =>
                      storage.attachmentKey(orgId, id),
                  },
                })) {
                  send(ev);
                }
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "chat failed";
                const code = isAppError(err) ? err.code : "PROVIDER_ERROR";
                send({ type: "error", message, code });
              } finally {
                clearInterval(keepalive);
                controller.close();
              }
            },
          });

          return withSecurityHeaders(
            new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                // Disable proxy buffering (nginx / some CDNs)
                "X-Accel-Buffering": "no",
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
