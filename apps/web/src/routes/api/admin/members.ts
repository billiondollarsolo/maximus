import { createFileRoute } from "@tanstack/react-router";
import { createInvite, requireAuth, requireOrgRole } from "@maximus/auth";
import { createDb, membersRepo, usageRepo } from "@maximus/db";
import { AppError, isAppError, type OrgRole } from "@maximus/domain";
import { sessionFromRequest } from "#/server/cookies";
import { serverEnv } from "#/server/env";

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
          return Response.json({ members, invites });
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
      POST: async ({ request }) => {
        try {
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
              return Response.json({ error: "email and role required" }, { status: 400 });
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
            return Response.json({ invite: inv });
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
            return Response.json({ member: row });
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
            return Response.json({ ok: true });
          }
          return Response.json({ error: "invalid action" }, { status: 400 });
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
