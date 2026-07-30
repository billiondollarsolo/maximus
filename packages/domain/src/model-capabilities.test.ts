import { describe, expect, it } from "vitest";
import {
  contentHasImages,
  modelAcceptsImages,
  modelCanGenerateImages,
  parseCapabilities,
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
    });
  });
});

describe("modelAcceptsImages / modelCanGenerateImages", () => {
  it("vision only accepts images", () => {
    expect(modelAcceptsImages({ vision: true })).toBe(true);
    expect(modelAcceptsImages({ vision: false })).toBe(false);
    expect(modelAcceptsImages({})).toBe(false);
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
