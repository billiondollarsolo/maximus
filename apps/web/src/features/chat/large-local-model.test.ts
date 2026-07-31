import { describe, expect, it } from "vitest";
import {
  isLargeLocalModel,
  parameterSizeBillionsFromModelId,
} from "./large-local-model";

describe("parameterSizeBillionsFromModelId", () => {
  it("parses common Ollama size tags", () => {
    expect(parameterSizeBillionsFromModelId("gemma4:31b")).toBe(31);
    expect(parameterSizeBillionsFromModelId("llama3.1:70b")).toBe(70);
    expect(parameterSizeBillionsFromModelId("qwen2.5:14b")).toBe(14);
    expect(parameterSizeBillionsFromModelId("gemma3:4b")).toBe(4);
    expect(parameterSizeBillionsFromModelId("llama3.1:8b")).toBe(8);
  });
});

describe("isLargeLocalModel", () => {
  it("flags Ollama models ≥13B", () => {
    expect(
      isLargeLocalModel("ollama:conn_x:gemma4:31b"),
    ).toBe(true);
    expect(
      isLargeLocalModel("ollama:platform:llama3.1:70b"),
    ).toBe(true);
    expect(
      isLargeLocalModel("ollama:conn_x:qwen2.5:14b"),
    ).toBe(true);
  });

  it("does not flag small Ollama models", () => {
    expect(isLargeLocalModel("ollama:conn_x:gemma3:4b")).toBe(false);
    expect(isLargeLocalModel("ollama:platform:llama3.1:8b")).toBe(false);
  });

  it("does not flag non-Ollama cloud models", () => {
    expect(
      isLargeLocalModel("openai:conn_x:gpt-5.6-luna"),
    ).toBe(false);
    expect(
      isLargeLocalModel("openai:platform:gpt-4.1"),
    ).toBe(false);
  });
});
