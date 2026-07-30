import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import {
  agentsRepo,
  getDb,
  providerRepo,
  resolveAgentForRun,
  usageRepo,
} from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const Route = createFileRoute("/api/admin/agents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const agents = await agentsRepo.listAgentPresets(db, ctx.orgId);
          return jsonOk({ agents });
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
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            action?: "create" | "resolve";
            name?: string;
            slug?: string;
            baseModelRef?: string;
            systemPrompt?: string;
            params?: Record<string, unknown>;
            id?: string;
          };

          if (body.action === "resolve" && body.id) {
            const agent = await agentsRepo.getAgentPreset(db, ctx.orgId, body.id);
            if (!agent) throw new AppError("NOT_FOUND", "Agent not found");
            const base = await providerRepo.getModelByRef(
              db,
              ctx.orgId,
              agent.baseModelRef,
            );
            const r = resolveAgentForRun({
              agent: {
                name: agent.name,
                baseModelRef: agent.baseModelRef,
                systemPrompt: agent.systemPrompt,
                params: (agent.params ?? {}) as Record<string, unknown>,
                isEnabled: agent.isEnabled,
              },
              baseOffering: base
                ? { modelRef: base.modelRef, isEnabled: base.isEnabled }
                : null,
            });
            if (!r.ok) throw new AppError("VALIDATION", r.error);
            return jsonOk({ resolved: r });
          }

          if (!body.name || !body.baseModelRef) {
            throw new AppError("VALIDATION", "name and baseModelRef required");
          }
          const base = await providerRepo.getModelByRef(
            db,
            ctx.orgId,
            body.baseModelRef,
          );
          if (!base) {
            throw new AppError("VALIDATION", "baseModelRef must be an org offering");
          }
          const row = await agentsRepo.createAgentPreset(db, {
            orgId: ctx.orgId,
            name: body.name,
            slug: body.slug?.trim() || slugify(body.name),
            baseModelRef: body.baseModelRef,
            systemPrompt: body.systemPrompt ?? null,
            params: body.params ?? {},
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "agent.created",
            resourceType: "agent_preset",
            resourceId: row.id,
            meta: { baseModelRef: body.baseModelRef },
          });
          return jsonOk({ agent: row });
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
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            id?: string;
            name?: string;
            baseModelRef?: string;
            systemPrompt?: string | null;
            params?: Record<string, unknown>;
            isEnabled?: boolean;
            isVisible?: boolean;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const row = await agentsRepo.updateAgentPreset(db, {
            id: body.id,
            orgId: ctx.orgId,
            name: body.name,
            baseModelRef: body.baseModelRef,
            systemPrompt: body.systemPrompt,
            params: body.params,
            isEnabled: body.isEnabled,
            isVisible: body.isVisible,
          });
          if (!row) throw new AppError("NOT_FOUND", "Agent not found");
          return jsonOk({ agent: row });
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
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as { id?: string };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          await agentsRepo.deleteAgentPreset(db, ctx.orgId, body.id);
          return jsonOk({ ok: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
