const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
]);

function isPrivateIp(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  if (hostname.endsWith(".local")) return true;
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export type SafeUrlOptions = {
  allowPrivate?: boolean;
};

/**
 * SSRF guard for provider base URLs.
 * Blocks non-http(s), metadata hosts, and private IPs unless allowPrivate.
 */
export function assertSafeBaseUrl(
  raw: string,
  opts: SafeUrlOptions = {},
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid base URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host === "169.254.169.254") {
    throw new Error("Blocked metadata host");
  }
  if (!opts.allowPrivate && isPrivateIp(host)) {
    throw new Error("Private/link-local base URLs are not allowed");
  }
  return url;
}
