import { describe, expect, it } from "vitest";
import { modelsForUser, type CatalogModel } from "./models-for-user.js";
import {
  defaultPlatformCatalog,
  defaultPlatformModelRef,
} from "./platform-catalog.js";

const base: CatalogModel[] = [
  {
    modelRef: "openai:platform:gpt-4.1",
    displayName: "GPT-4.1",
    providerKind: "openai",
    isEnabled: true,
    capabilities: { streaming: true },
  },
  {
    modelRef: "ollama:c1:off",
    displayName: "Off",
    providerKind: "ollama",
    isEnabled: false,
  },
  {
    modelRef: "ollama:c1:gemma3:4b",
    displayName: "gemma3:4b",
    providerKind: "ollama",
    isEnabled: true,
    isVisible: true,
  },
  {
    modelRef: "ollama:c1:hidden",
    displayName: "hidden",
    providerKind: "ollama",
    isEnabled: true,
    isVisible: false,
  },
  {
    modelRef: "ollama:c1:nomic-embed-text",
    displayName: "nomic-embed-text",
    providerKind: "ollama",
    isEnabled: true,
    capabilities: { embedding: true },
  },
];

describe("modelsForUser", () => {
  it("filters disabled, hidden, embeddings, allowlist", () => {
    const out = modelsForUser(base, "member", []);
    const refs = out.map((m) => m.modelRef);
    expect(refs).toContain("openai:platform:gpt-4.1");
    expect(refs).toContain("ollama:c1:gemma3:4b");
    expect(refs).not.toContain("ollama:c1:off");
    expect(refs).not.toContain("ollama:c1:hidden");
    expect(refs).not.toContain("ollama:c1:nomic-embed-text");
  });

  it("allowlist restricts", () => {
    const out = modelsForUser(base, "member", [
      { modelRef: "ollama:c1:gemma3:4b", role: null },
    ]);
    expect(out.map((m) => m.modelRef)).toEqual(["ollama:c1:gemma3:4b"]);
  });

  it("can include embeddings when requested", () => {
    const out = modelsForUser(base, "owner", [], { includeEmbeddings: true });
    expect(out.some((m) => m.modelRef.includes("nomic-embed"))).toBe(true);
  });
});

describe("defaultPlatformModelRef", () => {
  it("returns first enabled catalog model when keys present", () => {
    const env = { providerMode: "live" as const, openai: true };
    const ref = defaultPlatformModelRef(env);
    const cat = defaultPlatformCatalog(env);
    expect(ref).toBe(cat.find((m) => m.isEnabled)!.modelRef);
  });

  it("stable placeholder when catalog empty", () => {
    expect(defaultPlatformModelRef({ providerMode: "live" })).toBe(
      "openai:platform:gpt-4.1",
    );
  });
});
