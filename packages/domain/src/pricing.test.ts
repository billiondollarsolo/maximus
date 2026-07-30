import { describe, expect, it } from "vitest";
import { computeCostMicros, matchPriceRow } from "./pricing.js";

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

describe("matchPriceRow", () => {
  const orgId = "org_1";

  it("prefers exact over substring over *", () => {
    const best = matchPriceRow(
      [
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "*",
          inputUsdPer1m: 1,
          outputUsdPer1m: 1,
        },
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "gpt-4",
          inputUsdPer1m: 2,
          outputUsdPer1m: 2,
        },
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "gpt-4.1",
          inputUsdPer1m: 3,
          outputUsdPer1m: 3,
        },
      ],
      { orgId, providerKind: "openai", modelId: "gpt-4.1" },
    );
    expect(best?.inputUsdPer1m).toBe(3);
  });

  it("prefers longer substring when both match", () => {
    const best = matchPriceRow(
      [
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "gpt",
          inputUsdPer1m: 1,
          outputUsdPer1m: 1,
        },
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "gpt-4.1-mini",
          inputUsdPer1m: 5,
          outputUsdPer1m: 5,
        },
      ],
      { orgId, providerKind: "openai", modelId: "gpt-4.1-mini" },
    );
    expect(best?.inputUsdPer1m).toBe(5);
  });

  it("prefers org over platform at same specificity", () => {
    const best = matchPriceRow(
      [
        {
          orgId: null,
          providerKind: "openai",
          modelIdPattern: "*",
          inputUsdPer1m: 1,
          outputUsdPer1m: 1,
        },
        {
          orgId,
          providerKind: "openai",
          modelIdPattern: "*",
          inputUsdPer1m: 9,
          outputUsdPer1m: 9,
        },
      ],
      { orgId, providerKind: "openai", modelId: "anything" },
    );
    expect(best?.inputUsdPer1m).toBe(9);
    expect(best?.orgId).toBe(orgId);
  });

  it("returns null when no candidate matches", () => {
    const best = matchPriceRow(
      [
        {
          orgId: null,
          providerKind: "anthropic",
          modelIdPattern: "*",
          inputUsdPer1m: 1,
          outputUsdPer1m: 1,
        },
      ],
      { orgId, providerKind: "openai", modelId: "gpt" },
    );
    expect(best).toBeNull();
  });
});
