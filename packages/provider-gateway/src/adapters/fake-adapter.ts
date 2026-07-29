export type FakeChunk =
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string };

export type FakeTextAdapter = {
  kind: "fake";
  modelId: string;
  stream: (
    messages: Array<{ role: string; content: string }>,
    opts?: { signal?: AbortSignal },
  ) => AsyncGenerator<FakeChunk>;
};

/**
 * Scripted text adapter for tests/E2E without live provider network.
 */
export function createFakeTextAdapter(input: {
  modelId?: string;
  chunks?: FakeChunk[];
  delayMs?: number;
}): FakeTextAdapter {
  const chunks: FakeChunk[] = input.chunks ?? [
    { type: "text", text: "Hello " },
    { type: "text", text: "from fake." },
    { type: "usage", inputTokens: 10, outputTokens: 4 },
  ];
  const delayMs = input.delayMs ?? 0;

  return {
    kind: "fake",
    modelId: input.modelId ?? "fake-model",
    async *stream(_messages, opts) {
      for (const chunk of chunks) {
        if (opts?.signal?.aborted) {
          const err = new Error("aborted");
          err.name = "AbortError";
          throw err;
        }
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        if (opts?.signal?.aborted) {
          const err = new Error("aborted");
          err.name = "AbortError";
          throw err;
        }
        if (chunk.type === "error") {
          throw new Error(chunk.message);
        }
        yield chunk;
      }
    },
  };
}
