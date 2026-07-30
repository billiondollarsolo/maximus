import { describe, expect, it } from "vitest";
import { modelsForUser } from "./models-for-user.js";
import {
  defaultPlatformCatalog,
  defaultPlatformModelRef,
} from "./platform-catalog.js";

const catalog = [
  {
    modelRef: "openai:platform:gpt-4.1",
    displayName: "GPT-4.1",
    providerKind: "openai",
    isEnabled: true,
    capabilities: { vision: true },
  },
  {
    modelRef: "openai:platform:disabled",
    displayName: "Off",
    providerKind: "openai",
    isEnabled: false,
  },
  {
    modelRef: "anthropic:platform:claude",
    displayName: "Claude",
    providerKind: "anthropic",
    isEnabled: true,
  },
];

describe("modelsForUser", () => {
  it("returns all enabled when allowlist empty", () => {
    const out = modelsForUser(catalog, "member", []);
    expect(out.map((m) => m.modelRef)).toEqual([
      "openai:platform:gpt-4.1",
      "anthropic:platform:claude",
    ]);
  });

  it("filters by allowlist and role", () => {
    const out = modelsForUser(catalog, "member", [
      { modelRef: "openai:platform:gpt-4.1", role: "admin" },
      { modelRef: "anthropic:platform:claude", role: null },
    ]);
    expect(out.map((m) => m.modelRef)).toEqual(["anthropic:platform:claude"]);
  });

  it("admin can use role-scoped model", () => {
    const out = modelsForUser(catalog, "admin", [
      { modelRef: "openai:platform:gpt-4.1", role: "admin" },
    ]);
    expect(out.map((m) => m.modelRef)).toEqual(["openai:platform:gpt-4.1"]);
  });
});

describe("defaultPlatformModelRef", () => {
  it("returns first enabled catalog model when keys present", () => {
    const env = { providerMode: "live" as const, openai: true };
    const ref = defaultPlatformModelRef(env);
    const cat = defaultPlatformCatalog(env);
    expect(ref).toBe(cat.find((m) => m.isEnabled)!.modelRef);
    expect(cat.some((m) => m.modelRef === ref)).toBe(true);
  });

  it("stable placeholder when catalog empty", () => {
    expect(defaultPlatformModelRef({ providerMode: "live" })).toBe(
      "openai:platform:gpt-4.1",
    );
  });
});

