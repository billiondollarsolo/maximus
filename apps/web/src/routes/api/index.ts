import { createFileRoute } from "@tanstack/react-router";
import { withSecurityHeaders } from "#/server/security";

/**
 * Machine-readable API catalog. Auth: cookie session or
 * `Authorization: Bearer <sessionToken>` / `X-Session-Token`.
 * Mutations require same-origin Origin (or non-prod without Origin for curl).
 */
const CATALOG = {
  name: "maximus",
  apiVersion: "1",
  auth: {
    sessionCookie: "maximus_session",
    bearer: "Authorization: Bearer <sessionToken>",
    header: "X-Session-Token: <sessionToken>",
    obtainToken: "POST /api/auth/login → sessionToken (+ Set-Cookie)",
  },
  routes: [
    { method: "GET", path: "/api", auth: false, note: "This catalog" },
    { method: "GET", path: "/api/health", auth: false, note: "Shallow LB health" },

    { method: "GET", path: "/api/auth/status", auth: false },
    { method: "POST", path: "/api/auth/bootstrap", auth: false, note: "First owner only" },
    { method: "POST", path: "/api/auth/login", auth: false },
    { method: "POST", path: "/api/auth/logout", auth: true },
    { method: "GET", path: "/api/auth/me", auth: true },
    { method: "POST", path: "/api/auth/invite", auth: false, note: "Accept invite" },

    { method: "GET", path: "/api/me/instructions", auth: true },
    { method: "PUT", path: "/api/me/instructions", auth: true },

    { method: "GET", path: "/api/models", auth: true, note: "Catalog for chat" },
    { method: "GET", path: "/api/conversations", auth: true, note: "?id= | ?q=" },
    { method: "PATCH", path: "/api/conversations", auth: true },
    { method: "DELETE", path: "/api/conversations", auth: true },
    { method: "POST", path: "/api/chat", auth: true, note: "SSE stream" },
    { method: "POST", path: "/api/uploads", auth: true },
    { method: "GET", path: "/api/attachments/$id", auth: true },
    { method: "GET", path: "/api/export", auth: true, note: "?id=&format=md|json" },
    { method: "POST", path: "/api/feedback", auth: true },

    { method: "GET", path: "/api/admin/overview", auth: "admin" },
    { method: "GET", path: "/api/admin/overview/stream", auth: "admin", note: "SSE" },
    { method: "GET", path: "/api/admin/overview/settings", auth: "admin" },
    { method: "PATCH", path: "/api/admin/overview/settings", auth: "admin" },
    { method: "POST", path: "/api/admin/overview/probe", auth: "admin" },
    { method: "GET", path: "/api/admin/providers", auth: "admin" },
    { method: "POST", path: "/api/admin/providers", auth: "admin" },
    { method: "PATCH", path: "/api/admin/providers", auth: "admin" },
    { method: "DELETE", path: "/api/admin/providers", auth: "admin" },
    { method: "GET", path: "/api/admin/models", auth: "admin" },
    { method: "POST", path: "/api/admin/models", auth: "admin" },
    { method: "PATCH", path: "/api/admin/models", auth: "admin" },
    { method: "DELETE", path: "/api/admin/models", auth: "admin" },
    { method: "GET", path: "/api/admin/prices", auth: "admin" },
    { method: "POST", path: "/api/admin/prices", auth: "admin" },
    { method: "PATCH", path: "/api/admin/prices", auth: "admin" },
    { method: "DELETE", path: "/api/admin/prices", auth: "admin" },
    { method: "GET", path: "/api/admin/members", auth: "admin" },
    { method: "POST", path: "/api/admin/members", auth: "admin" },
    { method: "GET", path: "/api/admin/usage", auth: "admin" },
    { method: "GET", path: "/api/admin/audit", auth: "admin" },
  ],
} as const;

export const Route = createFileRoute("/api/")({
  server: {
    handlers: {
      GET: async () =>
        withSecurityHeaders(
          Response.json(CATALOG, {
            headers: { "Cache-Control": "public, max-age=60" },
          }),
        ),
    },
  },
});
