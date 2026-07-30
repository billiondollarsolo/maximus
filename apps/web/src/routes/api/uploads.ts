import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { attachments, createDb, newId } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { createStorageClient } from "@maximus/storage";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

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
          guardMutation(request);
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            filename?: string;
            mime?: string;
            sizeBytes?: number;
          };
          if (!body.filename || !body.mime || body.sizeBytes == null) {
            throw new AppError("VALIDATION", "invalid body");
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
          return jsonOk({
            attachmentId: id,
            uploadUrl,
            storageKey: key,
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
