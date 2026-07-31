import { describe, expect, it } from "vitest";
import {
  buildProviderInferenceFields,
  openaiUsesMaxCompletionTokens,
  resolveOpenAiMaxTokenParam,
} from "./build-provider-body.js";

describe("buildProviderInferenceFields", () => {
  it("maps OpenAI-compat fields", () => {
    const f = buildProviderInferenceFields("openai", {
      maxOutputTokens: 1024,
      temperature: 0,
      topP: 0.9,
      frequencyPenalty: 0.1,
      stop: ["END"],
    });
    expect(f).toEqual({
      max_tokens: 1024,
      temperature: 0,
      top_p: 0.9,
      frequency_penalty: 0.1,
      stop: ["END"],
    });
  });

  it("uses learned openaiMaxTokenParam over model-id heuristic", () => {
    expect(
      resolveOpenAiMaxTokenParam(
        { openaiMaxTokenParam: "max_completion_tokens" },
        "gpt-4.1-mini",
      ),
    ).toBe("max_completion_tokens");
    expect(
      resolveOpenAiMaxTokenParam(
        { openaiMaxTokenParam: "max_tokens" },
        "gpt-5.6-luna",
      ),
    ).toBe("max_tokens");

    const learned = buildProviderInferenceFields(
      "openai",
      { maxOutputTokens: 512, openaiMaxTokenParam: "max_completion_tokens" },
      { modelId: "custom-weird-name" },
    );
    expect(learned.max_completion_tokens).toBe(512);
    expect(learned.max_tokens).toBeUndefined();
  });

  it("heuristic bootstrap for gpt-5 / o-series when not yet learned", () => {
    expect(openaiUsesMaxCompletionTokens("gpt-5.6-luna")).toBe(true);
    expect(openaiUsesMaxCompletionTokens("o3-mini")).toBe(true);
    expect(openaiUsesMaxCompletionTokens("gpt-4.1-mini")).toBe(false);

    const f = buildProviderInferenceFields(
      "openai",
      { maxOutputTokens: 2048, temperature: 0.2 },
      { modelId: "gpt-5.6-luna" },
    );
    expect(f.max_completion_tokens).toBe(2048);
    expect(f.max_tokens).toBeUndefined();
  });

  it("maps Anthropic max_tokens + sampling", () => {
    const f = buildProviderInferenceFields("anthropic", {
      maxOutputTokens: 2048,
      temperature: 0.5,
    });
    expect(f.max_tokens).toBe(2048);
    expect(f.temperature).toBe(0.5);
  });

  it("maps Ollama options num_ctx and num_predict", () => {
    const f = buildProviderInferenceFields("ollama", {
      contextWindow: 8192,
      maxOutputTokens: 512,
      temperature: 0.2,
      numCtx: 4096,
    });
    expect(f.options).toEqual({
      num_ctx: 4096,
      num_predict: 512,
      temperature: 0.2,
    });
  });

  it("uses contextWindow as num_ctx when numCtx omitted", () => {
    const f = buildProviderInferenceFields("ollama", {
      contextWindow: 8192,
      maxOutputTokens: 256,
    });
    expect(f.options?.num_ctx).toBe(8192);
    expect(f.options?.num_predict).toBe(256);
  });
});
