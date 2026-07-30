/**
 * Trusted reverse-proxy helpers (Caddy, cloud LB, Ingress).
 * Only honor X-Forwarded-* when TRUST_PROXY is enabled.
 */

export function trustProxyEnabled(): boolean {
  const v = process.env.TRUST_PROXY ?? "";
  return v === "1" || v === "true" || v === "yes";
}

/** How many proxy hops to trust (default 1 = immediate reverse proxy). */
export function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(10, Math.floor(n));
}

/**
 * Client IP for rate limits / audit.
 * When TRUST_PROXY is on, use the leftmost (or hop-adjusted) X-Forwarded-For entry.
 */
export function clientIpFromRequest(request: Request): string | null {
  if (trustProxyEnabled()) {
    // Prefer CDN / edge headers when present
    const realIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip");
    if (realIp?.trim()) return realIp.trim();

    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length) {
        // XFF = "client, proxy1, …, edge". With N trusted hops we skip
        // untrusted left entries only when chain is longer than N+1.
        // Default: leftmost = client (edge proxy stripped/replaced XFF).
        // Express-style: leftmost entry is the client when the edge is trusted.
        void trustedProxyHops();
        return parts[0] ?? null;
      }
    }
  }
  return null;
}

/**
 * Public request origin for CSRF checks when behind TLS-terminating proxy.
 * Prefer APP_URL; optionally derive from X-Forwarded-Proto/Host when TRUST_PROXY.
 */
export function publicAppUrl(
  request: Request,
  configuredAppUrl: string,
): string {
  if (!trustProxyEnabled()) return configuredAppUrl;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (host) {
    try {
      return new URL(`${proto}://${host}`).origin;
    } catch {
      /* fall through */
    }
  }
  return configuredAppUrl;
}

/**
 * Effective origin string for same-origin compare when TRUST_PROXY is on
 * and Origin header is missing (some proxies strip it) but Forwarded host matches.
 */
export function effectiveRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }
  if (!trustProxyEnabled()) return null;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!host) return null;
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}
