import Redis from "ioredis";
import { AppError } from "@maximus/domain";

export type RateLimitResult = { allowed: boolean; remaining: number };

export type LimiterOptions = {
  userPerMin?: number;
  orgPerMin?: number;
  /** Optional per-IP limit (login / abuse); requires client IP */
  ipPerMin?: number;
  /** When Valkey is down */
  failOpen: boolean;
};

export function createLimiter(redisUrl: string | undefined) {
  let client: Redis | null = null;
  if (redisUrl) {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  async function ensureConnected() {
    if (!client) throw new Error("no redis");
    if (client.status !== "ready") {
      await client.connect().catch(() => undefined);
    }
    return client;
  }

  /**
   * Fixed window per minute for user + org.
   */
  async function check(
    input: { userId?: string; orgId?: string; ip?: string | null },
    opts: LimiterOptions,
  ): Promise<RateLimitResult> {
    const userLimit = opts.userPerMin ?? 60;
    const orgLimit = opts.orgPerMin ?? 600;
    const ipLimit = opts.ipPerMin ?? 0;
    const minute = Math.floor(Date.now() / 60_000);

    try {
      const r = await ensureConnected();
      const multi = r.multi();
      const keys: string[] = [];
      if (input.userId) {
        const userKey = `rl:user:${input.userId}:${minute}`;
        keys.push("user");
        multi.incr(userKey);
        multi.pexpire(userKey, 120_000);
      }
      if (input.orgId) {
        const orgKey = `rl:org:${input.orgId}:${minute}`;
        keys.push("org");
        multi.incr(orgKey);
        multi.pexpire(orgKey, 120_000);
      }
      if (ipLimit > 0 && input.ip) {
        const ipKey = `rl:ip:${input.ip}:${minute}`;
        keys.push("ip");
        multi.incr(ipKey);
        multi.pexpire(ipKey, 120_000);
      }
      if (!keys.length) {
        return { allowed: true, remaining: -1 };
      }
      const res = await multi.exec();
      let remaining = Infinity;
      let allowed = true;
      let resIdx = 0;
      for (const kind of keys) {
        const count = Number(res?.[resIdx]?.[1] ?? 0);
        resIdx += 2; // incr + pexpire
        if (kind === "user" && count > userLimit) allowed = false;
        if (kind === "org" && count > orgLimit) allowed = false;
        if (kind === "ip" && count > ipLimit) allowed = false;
        if (kind === "user") remaining = Math.min(remaining, userLimit - count);
        if (kind === "org") remaining = Math.min(remaining, orgLimit - count);
        if (kind === "ip") remaining = Math.min(remaining, ipLimit - count);
      }
      if (!allowed) return { allowed: false, remaining: 0 };
      return {
        allowed: true,
        remaining: Number.isFinite(remaining) ? remaining : -1,
      };
    } catch {
      if (opts.failOpen) {
        return { allowed: true, remaining: -1 };
      }
      throw new AppError(
        "RATE_LIMITED",
        "Rate limit service unavailable",
        503,
      );
    }
  }

  async function close() {
    if (client) await client.quit().catch(() => undefined);
  }

  return { check, close, client: () => client };
}

export async function assertRateLimit(
  limiter: ReturnType<typeof createLimiter>,
  input: { userId?: string; orgId?: string; ip?: string | null },
  opts: LimiterOptions,
) {
  const result = await limiter.check(input, opts);
  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests");
  }
  return result;
}
