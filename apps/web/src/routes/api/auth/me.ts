import { createFileRoute } from "@tanstack/react-router";
import {
  getAuthContext,
  listUserOrgMemberships,
} from "@maximus/auth";
import { getDb, getOrgSettings, teamsRepo } from "@maximus/db";
import { parseAccessMode } from "@maximus/domain";
import { serverEnv } from "#/server/env";
import { sessionFromRequest } from "#/server/cookies";
import { jsonError, jsonOk } from "#/server/api";
import { withSecurityHeaders } from "#/server/security";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = serverEnv();
          const db = getDb(env.databaseUrl);
          const ctx = await getAuthContext(sessionFromRequest(request), db);
          if (!ctx) {
            return withSecurityHeaders(
              Response.json({ user: null }, { status: 401 }),
            );
          }
          const orgs = await listUserOrgMemberships(db, ctx.user.id);
          const settings = await getOrgSettings(db, ctx.orgId);
          const teamIds = await teamsRepo.listTeamIdsForUser(
            db,
            ctx.orgId,
            ctx.user.id,
          );
          const teams = await teamsRepo.listTeams(db, ctx.orgId);
          const teamsInActiveOrg = teams
            .filter((t) => teamIds.includes(t.id))
            .map((t) => ({ id: t.id, name: t.name, slug: t.slug }));

          return jsonOk({
            user: ctx.user,
            orgId: ctx.orgId,
            role: ctx.role,
            activeOrg: {
              orgId: ctx.orgId,
              role: ctx.role,
              name: orgs.find((o) => o.orgId === ctx.orgId)?.name ?? ctx.orgId,
              slug: orgs.find((o) => o.orgId === ctx.orgId)?.slug ?? "",
            },
            orgs,
            teamsInActiveOrg,
            accessMode: parseAccessMode(settings.accessMode),
          });
        } catch (err) {
          return jsonError(err);
        }
      },
    },
  },
});
