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

  it("OpenAI body includes max_tokens and temperature from caps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n\n',
              ),
            );
            c.close();
          },
        }),
      })),
    );
    const adapter = createLiveHttpAdapter({
      providerKind: "openai",
      modelId: "gpt-4.1",
      apiKey: "sk",
      maxOutputTokens: 1024,
      temperature: 0,
      topP: 0.9,
    });
    for await (const _ of adapter.stream([{ role: "user", content: "hi" }])) {
      // drain
    }
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
      body: string;
    };
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0);
    expect(body.top_p).toBe(0.9);
  });

  it("Anthropic body includes max_tokens and temperature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                'event: message_start\ndata: {"type":"message_start"}\n\n' +
                  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"a"}}\n\n' +
                  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
              ),
            );
            c.close();
          },
        }),
      })),
    );
    const adapter = createLiveHttpAdapter({
      providerKind: "anthropic",
      modelId: "claude-sonnet-4",
      apiKey: "sk",
      maxOutputTokens: 2048,
      temperature: 0.5,
    });
    for await (const _ of adapter.stream([{ role: "user", content: "hi" }])) {
      // drain
    }
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
      body: string;
    };
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.max_tokens).toBe(2048);
    expect(body.temperature).toBe(0.5);
  });

  it("Ollama body includes options.num_ctx, num_predict, temperature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                JSON.stringify({ message: { content: "ok" }, done: true }) +
                  "\n",
              ),
            );
            c.close();
          },
        }),
      })),
    );
    const adapter = createLiveHttpAdapter({
      providerKind: "ollama",
      modelId: "gemma3:4b",
      baseUrl: "http://127.0.0.1:11434",
      maxOutputTokens: 512,
      numCtx: 4096,
      temperature: 0.2,
    });
    for await (const _ of adapter.stream([{ role: "user", content: "hi" }])) {
      // drain
    }
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
      body: string;
    };
    const body = JSON.parse(init.body) as {
      model: string;
      options?: Record<string, number>;
    };
    expect(body.model).toBe("gemma3:4b");
    expect(body.options).toMatchObject({
      num_ctx: 4096,
      num_predict: 512,
      temperature: 0.2,
    });
  });

  it("sends image_url data URL for multimodal user content", async () => {
    const pngB64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
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
      providerKind: "openai",
      modelId: "gpt-4.1",
      apiKey: "sk",
    });
    for await (const _ of adapter.stream([
      {
        role: "user",
        content: [
          { type: "text", text: "what?" },
          { type: "image", mime: "image/png", dataBase64: pngB64 },
        ],
      },
    ])) {
      // drain
    }
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
      body: string;
    };
    const parsed = JSON.parse(init.body) as {
      messages: Array<{ content: unknown }>;
    };
    const content = parsed.messages[0]!.content as Array<Record<string, unknown>>;
    expect(content.some((c) => c.type === "image_url")).toBe(true);
    expect(JSON.stringify(content)).toContain("data:image/png;base64,");
  });
});
