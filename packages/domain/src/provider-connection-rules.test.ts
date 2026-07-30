import { describe, expect, it } from "vitest";
import { validateProviderConnection } from "./provider-connection-rules.js";

describe("validateProviderConnection", () => {
  it("requires apiKey for openai", () => {
    const r = validateProviderConnection({ kind: "openai", apiKey: "" });
    expect(r.ok).toBe(false);
  });

  it("accepts openai with key and optional baseUrl", () => {
    const r = validateProviderConnection({
      kind: "openai",
      apiKey: "sk-x",
    });
    expect(r).toEqual({
      ok: true,
      kind: "openai",
      apiKey: "sk-x",
      baseUrl: null,
    });
  });

  it("requires baseUrl for openai_compatible", () => {
    const r = validateProviderConnection({
      kind: "openai_compatible",
      apiKey: "sk-x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/baseUrl/i);
  });

  it("accepts openai_compatible with key + baseUrl", () => {
    const r = validateProviderConnection({
      kind: "openai_compatible",
      apiKey: "sk-x",
      baseUrl: "https://api.example.com/v1",
    });
    expect(r.ok).toBe(true);
  });

  it("allows ollama with empty key and baseUrl", () => {
    const r = validateProviderConnection({
      kind: "ollama",
      apiKey: "",
      baseUrl: "http://127.0.0.1:11434",
    });
    expect(r).toEqual({
      ok: true,
      kind: "ollama",
      apiKey: "",
      baseUrl: "http://127.0.0.1:11434",
    });
  });

  it("requires baseUrl for ollama", () => {
    const r = validateProviderConnection({ kind: "ollama", apiKey: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown kind", () => {
    const r = validateProviderConnection({ kind: "foo", apiKey: "x" });
    expect(r.ok).toBe(false);
  });
});
