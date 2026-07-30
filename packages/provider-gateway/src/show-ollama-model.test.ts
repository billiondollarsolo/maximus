import { describe, expect, it, vi } from "vitest";
import { showOllamaModel } from "./show-ollama-model.js";

describe("showOllamaModel", () => {
  it("parses context_length from model_info", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          details: { family: "gemma", parameter_size: "4B" },
          model_info: { "gemma.context_length": 8192 },
        }),
        { status: 200 },
      ),
    );
    const d = await showOllamaModel({
      baseUrl: "http://127.0.0.1:11434",
      name: "gemma3:4b",
      allowPrivateBaseUrls: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(d?.contextWindow).toBe(8192);
    expect(d?.family).toBe("gemma");
    expect(d?.isEmbed).toBe(false);
  });

  it("marks embed models", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ details: { family: "nomic-bert" } }), {
        status: 200,
      }),
    );
    const d = await showOllamaModel({
      baseUrl: "http://127.0.0.1:11434",
      name: "nomic-embed-text",
      allowPrivateBaseUrls: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(d?.isEmbed).toBe(true);
  });
});
