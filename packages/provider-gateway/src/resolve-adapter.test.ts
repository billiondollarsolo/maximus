import { describe, expect, it } from "vitest";
import { AppError } from "@maximus/domain";
import { resolveAdapter } from "./resolve-adapter.js";

describe("resolveAdapter", () => {
  it("fake mode returns fake adapter", () => {
    const r = resolveAdapter({
      modelRef: "openai:platform:gpt-4.1",
      role: "member",
      allowlist: [],
      providerMode: "fake",
    });
    expect(r.adapter.kind).toBe("fake");
  });

  it("platform openai with key", () => {
    const r = resolveAdapter({
      modelRef: "openai:platform:gpt-4.1",
      role: "member",
      allowlist: [],
      platform: { openaiApiKey: "sk-x" },
      providerMode: "live",
    });
    expect(r.credentials.apiKey).toBe("sk-x");
    expect(r.credentials.source).toBe("platform");
  });

  it("missing credentials errors", () => {
    expect(() =>
      resolveAdapter({
        modelRef: "anthropic:platform:claude",
        role: "member",
        allowlist: [],
        providerMode: "live",
      }),
    ).toThrow(AppError);
  });

  it("allowlist deny", () => {
    expect(() =>
      resolveAdapter({
        modelRef: "openai:platform:gpt-4.1",
        role: "member",
        allowlist: [{ modelRef: "other", role: null }],
        providerMode: "fake",
      }),
    ).toThrow(/not allowed/i);
  });

  it("byok connection", () => {
    const r = resolveAdapter({
      modelRef: "openai_compatible:conn1:llama",
      role: "admin",
      allowlist: [],
      connection: {
        id: "conn1",
        kind: "openai_compatible",
        baseUrl: "https://api.example.com/v1",
        apiKey: "k",
        isEnabled: true,
      },
      providerMode: "live",
    });
    expect(r.credentials.source).toBe("byok");
    expect(r.credentials.baseUrl).toContain("example.com");
  });

  it("ollama private requires flag", () => {
    expect(() =>
      resolveAdapter({
        modelRef: "ollama:platform:llama3",
        role: "member",
        allowlist: [],
        platform: { ollamaBaseUrl: "http://127.0.0.1:11434" },
        allowPrivateBaseUrls: false,
        providerMode: "live",
      }),
    ).toThrow(/Private/);
  });
});
