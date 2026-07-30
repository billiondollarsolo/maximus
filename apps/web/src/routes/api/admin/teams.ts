import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, requireOrgRole } from "@maximus/auth";
import { getDb, teamsRepo, usageRepo, membersRepo } from "@maximus/db";
import { AppError } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/teams")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const teams = await teamsRepo.listTeams(db, ctx.orgId);
          const withMembers = await Promise.all(
            teams.map(async (t) => ({
              ...t,
              members: await teamsRepo.listTeamMembers(db, t.id),
            })),
          );
          return jsonOk({ teams: withMembers });
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
            action?: "create" | "add_member" | "remove_member";
            name?: string;
            slug?: string;
            teamId?: string;
            userId?: string;
          };

          if (body.action === "add_member" && body.teamId && body.userId) {
            const team = await teamsRepo.getTeam(db, ctx.orgId, body.teamId);
            if (!team) throw new AppError("NOT_FOUND", "Team not found");
            const members = await membersRepo.listMembers(db, ctx.orgId);
            if (!members.some((m) => m.userId === body.userId)) {
              throw new AppError("VALIDATION", "User is not an org member");
            }
            const row = await teamsRepo.addTeamMember(db, {
              teamId: body.teamId,
              userId: body.userId,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "team.member_added",
              resourceType: "team",
              resourceId: body.teamId,
              meta: { userId: body.userId },
            });
            return jsonOk({ member: row });
          }

          if (body.action === "remove_member" && body.teamId && body.userId) {
            const team = await teamsRepo.getTeam(db, ctx.orgId, body.teamId);
            if (!team) throw new AppError("NOT_FOUND", "Team not found");
            await teamsRepo.removeTeamMember(db, {
              teamId: body.teamId,
              userId: body.userId,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "team.member_removed",
              resourceType: "team",
              resourceId: body.teamId,
              meta: { userId: body.userId },
            });
            return jsonOk({ ok: true });
          }

          if (!body.name?.trim()) {
            throw new AppError("VALIDATION", "name required");
          }
          const team = await teamsRepo.createTeam(db, {
            orgId: ctx.orgId,
            name: body.name,
            slug: body.slug,
          });
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "team.created",
            resourceType: "team",
            resourceId: team.id,
            meta: { name: team.name },
          });
          return jsonOk({ team });
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
            slug?: string;
          };
          if (!body.id) throw new AppError("VALIDATION", "id required");
          const team = await teamsRepo.updateTeam(db, {
            id: body.id,
            orgId: ctx.orgId,
            name: body.name,
            slug: body.slug,
          });
          if (!team) throw new AppError("NOT_FOUND", "Team not found");
          return jsonOk({ team });
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
          await teamsRepo.deleteTeam(db, ctx.orgId, body.id);
          await usageRepo.insertAuditEvent(db, {
            orgId: ctx.orgId,
            actorUserId: ctx.user.id,
            action: "team.deleted",
            resourceType: "team",
            resourceId: body.id,
            meta: {},
          });
          return jsonOk({ ok: true });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
