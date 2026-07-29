import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { attachments, createDb, newId } from "@maximus/db";
import { AppError, isAppError } from "@maximus/domain";
import { createStorageClient } from "@maximus/storage";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/pdf",
]);

export const Route = createFileRoute("/api/uploads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            filename?: string;
            mime?: string;
            sizeBytes?: number;
          };
          if (!body.filename || !body.mime || body.sizeBytes == null) {
            return Response.json({ error: "invalid body" }, { status: 400 });
          }
          if (body.sizeBytes > MAX_BYTES) {
            throw new AppError("VALIDATION", "File too large");
          }
          if (!ALLOWED.has(body.mime)) {
            throw new AppError("VALIDATION", "MIME type not allowed");
          }
          const id = newId("att");
          const storage = createStorageClient(env.s3);
          const key = storage.attachmentKey(ctx.orgId, id);
          await db.insert(attachments).values({
            id,
            orgId: ctx.orgId,
            uploaderUserId: ctx.user.id,
            storageKey: key,
            filename: body.filename,
            mime: body.mime,
            sizeBytes: body.sizeBytes,
          });
          const uploadUrl = await storage.presignPut(key, body.mime);
          return Response.json({ attachmentId: id, uploadUrl, storageKey: key });
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
