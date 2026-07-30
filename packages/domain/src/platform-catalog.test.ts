import { describe, expect, it } from "vitest";
import {
  defaultPlatformCatalog,
  defaultPlatformModelRef,
  ollamaDiscoveredCatalog,
} from "./platform-catalog.js";

describe("defaultPlatformCatalog (gated)", () => {
  it("never injects demo models without keys (including fake mode)", () => {
    const cat = defaultPlatformCatalog({ providerMode: "fake" });
    expect(cat).toEqual([]);
  });

  it("live with no keys → empty static platform", () => {
    const cat = defaultPlatformCatalog({
      providerMode: "live",
      openai: false,
      anthropic: false,
      ollamaBaseUrl: true,
    });
    expect(cat).toEqual([]);
  });

  it("live + openai only", () => {
    const cat = defaultPlatformCatalog({
      providerMode: "live",
      openai: true,
      anthropic: false,
    });
    const refs = cat.map((m) => m.modelRef);
    expect(refs).toContain("openai:platform:gpt-4.1");
    expect(refs).toContain("openai:platform:gpt-image-1");
    expect(refs).not.toContain("anthropic:platform:claude-sonnet-4");
  });

  it("live + anthropic only", () => {
    const cat = defaultPlatformCatalog({
      providerMode: "live",
      openai: false,
      anthropic: true,
    });
    expect(cat.map((m) => m.modelRef)).toEqual([
      "anthropic:platform:claude-sonnet-4",
    ]);
  });
});

describe("ollamaDiscoveredCatalog", () => {
  it("builds platform refs with colon tags in modelId", () => {
    const rows = ollamaDiscoveredCatalog({
      modelNames: ["llama3.2:latest", "qwen2.5", "llama3.2:latest"],
      connectionId: "platform",
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.modelRef).toBe("ollama:platform:llama3.2:latest");
    expect(rows[1]!.modelRef).toBe("ollama:platform:qwen2.5");
    expect(rows[0]!.providerKind).toBe("ollama");
  });

  it("uses connection id for BYOK", () => {
    const rows = ollamaDiscoveredCatalog({
      modelNames: ["mistral"],
      connectionId: "conn_abc",
    });
    expect(rows[0]!.modelRef).toBe("ollama:conn_abc:mistral");
  });
});

describe("defaultPlatformModelRef", () => {
  it("falls back when catalog empty", () => {
    const env = { providerMode: "live" as const };
    expect(defaultPlatformModelRef(env)).toBe("openai:platform:gpt-4.1");
  });

  it("matches first enabled when keys present", () => {
    const env = { providerMode: "live" as const, openai: true };
    const ref = defaultPlatformModelRef(env);
    const cat = defaultPlatformCatalog(env);
    expect(ref).toBe(cat.find((m) => m.isEnabled)!.modelRef);
  });
});
