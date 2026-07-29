import { describe, expect, it } from "vitest";
import { isModelAllowed } from "./allowlist.js";

describe("isModelAllowed", () => {
  it("allows all when empty", () => {
    expect(isModelAllowed("member", "openai:platform:gpt-4.1", [])).toBe(true);
  });

  it("denies when not listed", () => {
    expect(
      isModelAllowed("member", "openai:platform:gpt-4.1", [
        { modelRef: "anthropic:platform:claude", role: null },
      ]),
    ).toBe(false);
  });

  it("role-scoped allow", () => {
    const rules = [
      { modelRef: "openai:platform:gpt-4.1", role: "admin" as const },
    ];
    expect(isModelAllowed("admin", "openai:platform:gpt-4.1", rules)).toBe(
      true,
    );
    expect(isModelAllowed("member", "openai:platform:gpt-4.1", rules)).toBe(
      false,
    );
  });
});
