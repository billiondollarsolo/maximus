import { describe, expect, it } from "vitest";
import {
  isModelRef,
  parseModelRef,
  serializeModelRef,
  type ModelRef,
} from "./model-ref.js";

describe("model-ref", () => {
  it("parses platform openai refs", () => {
    expect(parseModelRef("openai:platform:gpt-4.1")).toEqual({
      providerKind: "openai",
      connectionId: "platform",
      modelId: "gpt-4.1",
    } satisfies ModelRef);
  });

  it("parses openai_compatible with connection id", () => {
    expect(parseModelRef("openai_compatible:conn_abc:llama-3.1-70b")).toEqual({
      providerKind: "openai_compatible",
      connectionId: "conn_abc",
      modelId: "llama-3.1-70b",
    });
  });

  it("parses model ids that contain colons", () => {
    expect(parseModelRef("ollama:local:library/llama3.2:latest")).toEqual({
      providerKind: "ollama",
      connectionId: "local",
      modelId: "library/llama3.2:latest",
    });
  });

  it("roundtrips serialize → parse", () => {
    const ref: ModelRef = {
      providerKind: "anthropic",
      connectionId: "conn_xyz",
      modelId: "claude-sonnet-4",
    };
    expect(parseModelRef(serializeModelRef(ref))).toEqual(ref);
  });

  it("rejects invalid refs", () => {
    expect(() => parseModelRef("")).toThrow(/Invalid model ref/);
    expect(() => parseModelRef("openai")).toThrow(/Invalid model ref/);
    expect(() => parseModelRef("openai:")).toThrow(/Invalid model ref/);
    expect(() => parseModelRef("nope:platform:x")).toThrow(/Invalid model ref/);
  });

  it("isModelRef type guard", () => {
    expect(isModelRef("openai:platform:gpt-4.1")).toBe(true);
    expect(isModelRef("not-a-ref")).toBe(false);
  });
});
