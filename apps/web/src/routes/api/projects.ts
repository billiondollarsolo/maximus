import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@maximus/auth";
import { getDb, projectsRepo, conversationRepo } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const projects = await projectsRepo.listProjects(db, {
            orgId: ctx.orgId,
            userId: ctx.user.id,
          });
          return jsonOk({ projects });
        } catch (err) {
          return jsonError(err);
        }
      },
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          const body = (await request.json()) as {
            name?: string;
            instructions?: string | null;
            defaultModelRef?: string | null;
          };
          if (!body.name?.trim()) {
            throw new AppError("VALIDATION", "name required");
          }
          const project = await projectsRepo.createProject(db, {
            orgId: ctx.orgId,
            ownerUserId: ctx.user.id,
            name: body.name,
            instructions: body.instructions,
            defaultModelRef: body.defaultModelRef,
          });
          return jsonOk({ project });
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
            id?: string;
            name?: string;
            instructions?: string | null;
            defaultModelRef?: string | null;
            conversationId?: string;
            projectId?: string | null;
          };
          // Assign conversation to project
          if (body.conversationId) {
            const conv = await conversationRepo.getConversation(
              db,
              body.conversationId,
            );
            if (!conv || conv.userId !== ctx.user.id || conv.orgId !== ctx.orgId) {
              throw new AppError("NOT_FOUND", "Conversation not found");
            }
            if (body.projectId) {
              const p = await projectsRepo.getProject(db, body.projectId);
              if (!p || p.ownerUserId !== ctx.user.id) {
                throw new AppError("NOT_FOUND", "Project not found");
              }
            }
            const updated = await conversationRepo.updateConversation(
              db,
              body.conversationId,
              { projectId: body.projectId ?? null },
            );
            return jsonOk({ conversation: updated });
          }

          if (!body.id) throw new AppError("VALIDATION", "id required");
          const project = await projectsRepo.updateProject(db, {
            id: body.id,
            orgId: ctx.orgId,
            ownerUserId: ctx.user.id,
            name: body.name,
            instructions: body.instructions,
            defaultModelRef: body.defaultModelRef,
          });
          if (!project) throw new AppError("NOT_FOUND", "Project not found");
          return jsonOk({ project });
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
          const body = (await request.json()) as { id?: string };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const deleted = await projectsRepo.deleteProject(db, {
            id: body.id,
            orgId: ctx.orgId,
            ownerUserId: ctx.user.id,
          });
          if (!deleted) throw new AppError("NOT_FOUND", "Project not found");
          return jsonOk({ deleted: true, id: body.id });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
