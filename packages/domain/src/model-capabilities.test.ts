import { describe, expect, it } from "vitest";
import {
  buildCapabilities,
  contentHasImages,
  isEmbeddingCapability,
  mergeCapabilities,
  modelAcceptsImages,
  modelCanGenerateImages,
  parseCapabilities,
  validateSamplingParams,
} from "./model-capabilities.js";

describe("parseCapabilities", () => {
  it("defaults streaming true", () => {
    expect(parseCapabilities(undefined)).toEqual({ streaming: true });
  });

  it("reads vision and imageGen flags", () => {
    expect(
      parseCapabilities({ vision: true, imageGen: true, streaming: false }),
    ).toEqual({
      streaming: false,
      vision: true,
      imageGen: true,
      tools: false,
      embedding: false,
    });
  });

  it("reads context, output, sampling, embedding", () => {
    const c = parseCapabilities({
      contextWindow: 8192,
      maxOutputTokens: "2048",
      num_ctx: 4096,
      temperature: 0.2,
      top_p: 0.9,
      stop: ["User:"],
      embedding: true,
    });
    expect(c).toMatchObject({
      contextWindow: 8192,
      maxOutputTokens: 2048,
      numCtx: 4096,
      temperature: 0.2,
      topP: 0.9,
      stop: ["User:"],
      embedding: true,
    });
    expect(isEmbeddingCapability(c)).toBe(true);
  });
});

describe("mergeCapabilities", () => {
  it("later layers win", () => {
    const m = mergeCapabilities(
      { streaming: true, maxOutputTokens: 4096, temperature: 0.7 },
      { maxOutputTokens: 2048 },
      { temperature: 0 },
    );
    expect(m.maxOutputTokens).toBe(2048);
    expect(m.temperature).toBe(0);
    expect(m.streaming).toBe(true);
  });
});

describe("validateSamplingParams", () => {
  it("rejects out of range", () => {
    expect(validateSamplingParams({ temperature: 3 })).toMatch(/temperature/);
    expect(validateSamplingParams({ topP: 1.5 })).toMatch(/topP/);
    expect(validateSamplingParams({ temperature: 0.5, topP: 0.9 })).toBeNull();
  });
});

describe("buildCapabilities", () => {
  it("omits empty optionals", () => {
    const b = buildCapabilities({ vision: true, contextWindow: 8192 });
    expect(b.vision).toBe(true);
    expect(b.contextWindow).toBe(8192);
    expect(b.temperature).toBeUndefined();
  });
});

describe("modelAcceptsImages / modelCanGenerateImages", () => {
  it("vision only accepts images", () => {
    expect(modelAcceptsImages({ vision: true })).toBe(true);
    expect(modelAcceptsImages({ vision: false })).toBe(false);
  });

  it("imageGen only generates", () => {
    expect(modelCanGenerateImages({ imageGen: true })).toBe(true);
    expect(modelCanGenerateImages({ vision: true })).toBe(false);
  });
});

describe("contentHasImages", () => {
  it("detects image parts", () => {
    expect(contentHasImages([{ type: "text" }])).toBe(false);
    expect(
      contentHasImages([{ type: "text" }, { type: "image" }]),
    ).toBe(true);
  });
});
