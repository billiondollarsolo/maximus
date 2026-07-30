import { describe, expect, it } from "vitest";
import {
  estimateMessagesTokens,
  shouldRefuseForContext,
} from "./context-budget.js";

describe("shouldRefuseForContext", () => {
  it("does not refuse without contextWindow", () => {
    expect(
      shouldRefuseForContext({
        estimatedInputTokens: 1_000_000,
        contextWindow: null,
      }).refuse,
    ).toBe(false);
  });

  it("refuses when over budget", () => {
    const r = shouldRefuseForContext({
      estimatedInputTokens: 10_000,
      contextWindow: 8192,
      maxOutputTokens: 2048,
      headroom: 512,
      modelLabel: "gemma3:4b",
    });
    // budget = 8192 - 2048 - 512 = 5632
    expect(r.refuse).toBe(true);
    expect(r.reason).toMatch(/Prompt too long/);
    expect(r.reason).toContain("gemma3:4b");
    expect(r.budget).toBe(5632);
  });

  it("allows under budget", () => {
    const r = shouldRefuseForContext({
      estimatedInputTokens: 1000,
      contextWindow: 8192,
      maxOutputTokens: 2048,
    });
    expect(r.refuse).toBe(false);
  });
});

describe("estimateMessagesTokens", () => {
  it("grows with content", () => {
    const small = estimateMessagesTokens([{ content: "hi" }]);
    const big = estimateMessagesTokens([
      { content: "x".repeat(4000) },
    ]);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeGreaterThanOrEqual(1000);
  });
});
