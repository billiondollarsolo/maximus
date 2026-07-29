import { describe, expect, it, vi, afterEach } from "vitest";
import { createLiveHttpAdapter } from "./live-http.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createLiveHttpAdapter", () => {
  it("streams OpenAI-compat SSE chunks via fetch", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(sse));
            c.close();
          },
        }),
      })),
    );
    const adapter = createLiveHttpAdapter({
      providerKind: "openai",
      modelId: "gpt-4.1",
      apiKey: "sk-test",
    });
    const texts: string[] = [];
    let usage = null as null | { inputTokens: number; outputTokens: number };
    for await (const c of adapter.stream([
      { role: "user", content: "hello" },
    ])) {
      if (c.type === "text") texts.push(c.text);
      if (c.type === "usage") usage = c;
    }
    expect(texts.join("")).toBe("Hi!");
    expect(usage).toMatchObject({ inputTokens: 3, outputTokens: 2 });
    expect(fetch).toHaveBeenCalled();
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toContain("/chat/completions");
  });

  it("uses custom baseUrl for openai_compatible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
              ),
            );
            c.close();
          },
        }),
      })),
    );
    const adapter = createLiveHttpAdapter({
      providerKind: "openai_compatible",
      modelId: "llama",
      apiKey: "k",
      baseUrl: "https://compat.example/v1",
    });
    for await (const _ of adapter.stream([{ role: "user", content: "x" }])) {
      // drain
    }
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toBe(
      "https://compat.example/v1/chat/completions",
    );
  });
});
