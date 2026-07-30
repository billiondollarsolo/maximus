import { createFileRoute } from "@tanstack/react-router";
import { createInvite, requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, membersRepo, usageRepo } from "@maximus/db";
import { AppError, type OrgRole } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";
import { guardMutation, jsonError, jsonOk } from "#/server/api";

export const Route = createFileRoute("/api/admin/members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const [members, invites] = await Promise.all([
            membersRepo.listMembers(db, ctx.orgId),
            membersRepo.listPendingInvites(db, ctx.orgId),
          ]);
          return jsonOk({ members, invites });
        } catch (err) {
          return jsonError(err);
        }
      },
      POST: async ({ request }) => {
        try {
          guardMutation(request);
          const env = serverEnv();
          const db = createDb(env.databaseUrl);
          const ctx = await requireAuth(sessionFromRequest(request), db);
          requireOrgRole(ctx, "admin");
          const body = (await request.json()) as {
            action?: "invite" | "setRole" | "remove";
            email?: string;
            role?: OrgRole;
            userId?: string;
          };
          if (body.action === "invite") {
            if (!body.email || !body.role) {
              throw new AppError("VALIDATION", "email and role required");
            }
            const inv = await createInvite(
              ctx,
              { email: body.email, role: body.role },
              db,
            );
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "member.invited",
              resourceType: "invitation",
              resourceId: inv.id,
              meta: { email: body.email, role: body.role },
            });
            return jsonOk({ invite: inv });
          }
          if (body.action === "setRole" && body.userId && body.role) {
            const row = await membersRepo.setMemberRole(db, {
              orgId: ctx.orgId,
              userId: body.userId,
              role: body.role,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "member.role_changed",
              resourceType: "member",
              resourceId: body.userId,
              meta: { role: body.role },
            });
            return jsonOk({ member: row });
          }
          if (body.action === "remove" && body.userId) {
            await membersRepo.removeMember(db, {
              orgId: ctx.orgId,
              userId: body.userId,
            });
            await usageRepo.insertAuditEvent(db, {
              orgId: ctx.orgId,
              actorUserId: ctx.user.id,
              action: "member.removed",
              resourceType: "member",
              resourceId: body.userId,
            });
            return jsonOk({ ok: true });
          }
          throw new AppError("VALIDATION", "invalid action");
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
