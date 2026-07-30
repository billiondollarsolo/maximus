import { describe, expect, it } from "vitest";
import {
  openAiModelsUrl,
  testProviderConnection,
} from "./test-connection.js";

describe("openAiModelsUrl", () => {
  it("handles base ending with /v1", () => {
    expect(openAiModelsUrl(new URL("https://api.openai.com/v1"))).toBe(
      "https://api.openai.com/v1/models",
    );
  });

  it("handles base ending with /v1/ (no double v1)", () => {
    expect(openAiModelsUrl(new URL("https://api.openai.com/v1/"))).toBe(
      "https://api.openai.com/v1/models",
    );
  });

  it("appends /v1/models for bare host", () => {
    expect(openAiModelsUrl(new URL("https://proxy.example.com"))).toBe(
      "https://proxy.example.com/v1/models",
    );
  });

  it("keeps custom prefix path before /v1", () => {
    expect(
      openAiModelsUrl(new URL("https://proxy.example.com/llm/v1/")),
    ).toBe("https://proxy.example.com/llm/v1/models");
  });
});

describe("testProviderConnection", () => {
  it("ollama hits /api/tags with allowPrivate", async () => {
    let calledUrl = "";
    const result = await testProviderConnection({
      kind: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      allowPrivateBaseUrls: true,
      fetchImpl: async (url) => {
        calledUrl = String(url);
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      },
    });
    expect(result.ok).toBe(true);
    expect(calledUrl).toContain("/api/tags");
  });

  it("openai uses Authorization bearer and models path", async () => {
    let auth = "";
    let calledUrl = "";
    const result = await testProviderConnection({
      kind: "openai",
      apiKey: "sk-test",
      fetchImpl: async (url, init) => {
        calledUrl = String(url);
        auth = (init?.headers as Record<string, string>).Authorization ?? "";
        return new Response("{}", { status: 200 });
      },
    });
    expect(result.ok).toBe(true);
    expect(auth).toBe("Bearer sk-test");
    expect(calledUrl).toContain("/models");
    expect(calledUrl).not.toContain("/v1/v1/");
  });

  it("openai_compatible with trailing /v1/ does not double path", async () => {
    let calledUrl = "";
    const result = await testProviderConnection({
      kind: "openai_compatible",
      baseUrl: "https://api.openai.com/v1/",
      apiKey: "sk-x",
      fetchImpl: async (url) => {
        calledUrl = String(url);
        return new Response("{}", { status: 200 });
      },
    });
    expect(result.ok).toBe(true);
    expect(calledUrl).toBe("https://api.openai.com/v1/models");
  });

  it("rejects private baseUrl when not allowed", async () => {
    const result = await testProviderConnection({
      kind: "openai_compatible",
      baseUrl: "http://192.168.1.1/v1",
      apiKey: "x",
      allowPrivateBaseUrls: false,
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("SSRF");
  });

  it("maps HTTP error status", async () => {
    const result = await testProviderConnection({
      kind: "openai",
      apiKey: "sk",
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});
