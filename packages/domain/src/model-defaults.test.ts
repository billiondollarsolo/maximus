import { describe, expect, it } from "vitest";
import {
  pickDefaultModelRef,
  resolveEffectiveParams,
} from "./model-defaults.js";

describe("resolveEffectiveParams", () => {
  it("applies code → org → offering → conversation", () => {
    const caps = resolveEffectiveParams({
      codeDefaults: { maxOutputTokens: 4096, temperature: 1 },
      orgDefaults: { contextWindow: 8192, maxOutputTokens: 2048 },
      offering: { maxOutputTokens: 1024, temperature: 0.3 },
      conversationOverride: { temperature: 0 },
    });
    expect(caps.contextWindow).toBe(8192);
    expect(caps.maxOutputTokens).toBe(1024);
    expect(caps.temperature).toBe(0);
  });
});

describe("pickDefaultModelRef", () => {
  it("prefers defaults then pins then first catalog", () => {
    expect(
      pickDefaultModelRef({
        defaultModelRefs: ["a", "missing"],
        pinnedModelRefs: ["b"],
        catalogRefs: ["x", "a", "b"],
      }),
    ).toBe("a");
    expect(
      pickDefaultModelRef({
        defaultModelRefs: ["missing"],
        pinnedModelRefs: ["b"],
        catalogRefs: ["x", "b"],
      }),
    ).toBe("b");
    expect(
      pickDefaultModelRef({
        catalogRefs: ["only"],
      }),
    ).toBe("only");
    expect(pickDefaultModelRef({ catalogRefs: [] })).toBeNull();
  });
});
