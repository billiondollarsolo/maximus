export const SESSION_COOKIE = "maximus_session";

export function parseCookieHeader(
  header: string | null,
): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

/**
 * Resolve session for browser cookies **or** API clients.
 * Order: `Authorization: Bearer <token>` → `X-Session-Token` → cookie.
 */
export function sessionFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m?.[1]) return m[1].trim();
  }
  const headerTok = request.headers.get("x-session-token");
  if (headerTok?.trim()) return headerTok.trim();
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE] ?? null;
}

/**
 * Secure cookies by default in production, but allow explicit opt-out for
 * local HTTP smoke (`COOKIE_SECURE=false` with TLS_MODE=off).
 */
function cookieSecureFlag(): boolean {
  const v = (process.env.COOKIE_SECURE ?? "").toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

export function sessionCookieHeader(token: string): string {
  const secure = cookieSecureFlag() ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure}`;
}

export function clearSessionCookieHeader(): string {
  const secure = cookieSecureFlag() ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
