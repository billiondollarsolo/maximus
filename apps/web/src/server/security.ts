import { AppError } from "@maximus/domain";
import { effectiveRequestOrigin, trustProxyEnabled } from "./proxy";

/** Apply enterprise security headers to a Response. */
export function withSecurityHeaders(res: Response, opts?: { hsts?: boolean }): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (opts?.hsts ?? process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Same-origin / CSRF-style guard for state-changing requests.
 * Allows missing Origin in same-site navigations when Referer matches app.
 */
export function assertSameOrigin(request: Request, appUrl: string): void {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }
  let app: URL;
  try {
    app = new URL(appUrl);
  } catch {
    return;
  }
  const origin = request.headers.get("origin");
  if (origin) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      throw new AppError("FORBIDDEN", "Invalid Origin");
    }
    if (o.origin !== app.origin) {
      throw new AppError("FORBIDDEN", "Cross-origin request blocked");
    }
    return;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === app.origin) return;
    } catch {
      throw new AppError("FORBIDDEN", "Invalid Referer");
    }
    throw new AppError("FORBIDDEN", "Cross-origin request blocked");
  }
  // Behind trusted proxy without Origin (some LBs): accept Forwarded host = APP_URL
  if (trustProxyEnabled()) {
    const eff = effectiveRequestOrigin(request);
    if (eff && eff === app.origin) return;
  }
  // No Origin/Referer — allow non-browser clients (curl/tests) in non-production
  if (process.env.NODE_ENV === "production") {
    throw new AppError("FORBIDDEN", "Missing Origin");
  }
}
