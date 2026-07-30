import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb } from "@maximus/db";
import { sessionFromRequest } from "#/server/cookies";
import { jsonError } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";
import {
  buildOverviewSnapshot,
  getOverviewEnv,
} from "#/server/overview/build-overview-snapshot";
import {
  probesAreDue,
  runProviderProbes,
} from "#/server/overview/run-provider-probes";

/**
 * Admin overview SSE: immediate snapshot, then recompute on interval.
 * Provider probes (if enabled) run only while this stream is open.
 */
export const Route = createFileRoute("/api/admin/overview/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = getOverviewEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");

          const intervalMs = Math.max(
            2000,
            env.overviewSseIntervalMs ?? 5000,
          );
          const abort = request.signal;
          const enc = new TextEncoder();

          const stream = new ReadableStream({
            async start(controller) {
              let closed = false;
              let probeInFlight = false;

              const close = () => {
                if (closed) return;
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* already closed */
                }
              };

              const send = (event: string, data: unknown) => {
                if (closed || abort.aborted) return;
                controller.enqueue(
                  enc.encode(
                    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                  ),
                );
              };

              const tick = async () => {
                if (closed || abort.aborted) return;
                try {
                  const snapshot = await buildOverviewSnapshot({
                    db,
                    orgId: ctx.orgId,
                    env,
                  });

                  // Optional probes only while stream open (MVP).
                  if (
                    !probeInFlight &&
                    probesAreDue({
                      enabled: snapshot.probes.enabled,
                      intervalMinutes: snapshot.probes.intervalMinutes,
                      lastRunAt: snapshot.probes.lastRunAt,
                    })
                  ) {
                    probeInFlight = true;
                    void runProviderProbes({
                      db,
                      orgId: ctx.orgId,
                      env,
                    })
                      .catch(() => {
                        /* next snapshot still healthy */
                      })
                      .finally(() => {
                        probeInFlight = false;
                      });
                  }

                  send("snapshot", snapshot);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "snapshot failed";
                  send("error", { message });
                }
              };

              // Immediate first snapshot
              await tick();

              const recompute = setInterval(() => {
                void tick();
              }, intervalMs);

              const keepalive = setInterval(() => {
                if (closed || abort.aborted) return;
                try {
                  controller.enqueue(enc.encode(`: keepalive\n\n`));
                  send("tick", { serverTime: new Date().toISOString() });
                } catch {
                  /* ignore */
                }
              }, 15_000);

              const onAbort = () => {
                clearInterval(recompute);
                clearInterval(keepalive);
                close();
              };

              if (abort.aborted) {
                onAbort();
                return;
              }
              abort.addEventListener("abort", onAbort);
            },
          });

          return withSecurityHeaders(
            new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
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
