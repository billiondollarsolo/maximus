import { describe, expect, it, afterAll } from "vitest";
import { AppError } from "@maximus/domain";
import { assertRateLimit, createLimiter } from "./limiter.js";

const VALKEY_URL = process.env.VALKEY_URL ?? "redis://localhost:6379";

describe("valkey rate limiter", () => {
  const limiter = createLimiter(VALKEY_URL);

  afterAll(async () => {
    await limiter.close();
  });

  it("allows under limit and trips over limit", async () => {
    const userId = `u-${Date.now()}`;
    const orgId = `o-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check(
        { userId, orgId },
        { userPerMin: 3, orgPerMin: 100, failOpen: false },
      );
      expect(r.allowed).toBe(true);
    }
    const denied = await limiter.check(
      { userId, orgId },
      { userPerMin: 3, orgPerMin: 100, failOpen: false },
    );
    expect(denied.allowed).toBe(false);
    await expect(
      assertRateLimit(
        limiter,
        { userId, orgId },
        { userPerMin: 3, orgPerMin: 100, failOpen: false },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
