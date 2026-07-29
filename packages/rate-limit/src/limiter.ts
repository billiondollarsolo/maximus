import Redis from "ioredis";
import { AppError } from "@maximus/domain";

export type RateLimitResult = { allowed: boolean; remaining: number };

export type LimiterOptions = {
  userPerMin?: number;
  orgPerMin?: number;
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
    input: { userId: string; orgId: string },
    opts: LimiterOptions,
  ): Promise<RateLimitResult> {
    const userLimit = opts.userPerMin ?? 60;
    const orgLimit = opts.orgPerMin ?? 600;
    const minute = Math.floor(Date.now() / 60_000);
    const userKey = `rl:user:${input.userId}:${minute}`;
    const orgKey = `rl:org:${input.orgId}:${minute}`;

    try {
      const r = await ensureConnected();
      const multi = r.multi();
      multi.incr(userKey);
      multi.pexpire(userKey, 120_000);
      multi.incr(orgKey);
      multi.pexpire(orgKey, 120_000);
      const res = await multi.exec();
      const userCount = Number(res?.[0]?.[1] ?? 0);
      const orgCount = Number(res?.[2]?.[1] ?? 0);
      if (userCount > userLimit || orgCount > orgLimit) {
        return { allowed: false, remaining: 0 };
      }
      return {
        allowed: true,
        remaining: Math.min(userLimit - userCount, orgLimit - orgCount),
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
  input: { userId: string; orgId: string },
  opts: LimiterOptions,
) {
  const result = await limiter.check(input, opts);
  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests");
  }
  return result;
}
