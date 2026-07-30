import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { attachmentsRepo, getDb } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { createStorageClient } from "@maximus/storage";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { jsonError } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/attachments/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const id = params.id;
          if (!id) throw new AppError("NOT_FOUND", "Not found");

          const row = await attachmentsRepo.getAttachmentForOrg(
            db,
            ctx.orgId,
            id,
          );
          if (!row) {
            throw new AppError("NOT_FOUND", "Not found");
          }

          const storage = createStorageClient(env.s3);
          let body: Buffer;
          try {
            const obj = await storage.getObjectBuffer(row.storageKey);
            body = obj.body;
          } catch {
            throw new AppError("NOT_FOUND", "Not found");
          }

          return withSecurityHeaders(
            new Response(new Uint8Array(body), {
              status: 200,
              headers: {
                "Content-Type": row.mime || "application/octet-stream",
                "Content-Length": String(body.length),
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
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
