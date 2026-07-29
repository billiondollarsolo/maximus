import { describe, expect, it } from "vitest";
import { computeCostMicros } from "./pricing.js";

describe("computeCostMicros", () => {
  it("computes micro-USD", () => {
    // 1M in + 1M out at $1/$2 → $3 → 3_000_000 micros
    expect(
      computeCostMicros({
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        price: { inputUsdPer1m: 1, outputUsdPer1m: 2 },
      }),
    ).toBe(3_000_000);
  });

  it("returns null without price", () => {
    expect(
      computeCostMicros({
        inputTokens: 100,
        outputTokens: 50,
        price: null,
      }),
    ).toBeNull();
  });

  it("rounds fractional micros", () => {
    const cost = computeCostMicros({
      inputTokens: 1,
      outputTokens: 0,
      price: { inputUsdPer1m: 1, outputUsdPer1m: 0 },
    });
    expect(cost).toBe(1); // 1e-6 USD → 1 micro
  });
});
