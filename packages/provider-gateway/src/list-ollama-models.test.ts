import { describe, expect, it, vi } from "vitest";
import { listOllamaModels } from "./list-ollama-models.js";

describe("listOllamaModels", () => {
  it("parses /api/tags payload", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          models: [
            { name: "llama3.2:latest" },
            { name: "qwen2.5:7b" },
            { model: "nomic-embed-text" },
          ],
        }),
        { status: 200 },
      ),
    );
    const tags = await listOllamaModels({
      baseUrl: "http://127.0.0.1:11434",
      allowPrivateBaseUrls: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalled();
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toBe("http://127.0.0.1:11434/api/tags");
    expect(tags.map((t) => t.name)).toEqual([
      "llama3.2:latest",
      "qwen2.5:7b",
      "nomic-embed-text",
    ]);
  });

  it("returns [] on failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const tags = await listOllamaModels({
      baseUrl: "http://127.0.0.1:11434",
      allowPrivateBaseUrls: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(tags).toEqual([]);
  });

  it("returns [] on empty baseUrl", async () => {
    expect(await listOllamaModels({ baseUrl: "  " })).toEqual([]);
  });
});
