import { describe, expect, it } from "vitest";
import { isEmbeddingModelName } from "./embed-heuristic.js";

describe("isEmbeddingModelName", () => {
  it("detects common embedding ids", () => {
    expect(isEmbeddingModelName("nomic-embed-text")).toBe(true);
    expect(isEmbeddingModelName("mxbai-embed-large")).toBe(true);
    expect(isEmbeddingModelName("bge-m3")).toBe(true);
    expect(isEmbeddingModelName("all-minilm")).toBe(true);
    expect(isEmbeddingModelName("embeddinggemma")).toBe(true);
  });

  it("allows chat models", () => {
    expect(isEmbeddingModelName("gemma3:4b")).toBe(false);
    expect(isEmbeddingModelName("llama3.2:latest")).toBe(false);
    expect(isEmbeddingModelName("qwen2.5:1.5b")).toBe(false);
  });
});
