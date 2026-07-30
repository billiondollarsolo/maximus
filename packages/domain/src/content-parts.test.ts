import { describe, expect, it } from "vitest";
import {
  imagePart,
  normalizeContentParts,
  textFromParts,
} from "./content-parts.js";

describe("normalizeContentParts", () => {
  it("accepts legacy image without source", () => {
    const parts = normalizeContentParts([
      { type: "text", text: "hi" },
      { type: "image", attachmentId: "att_1", mime: "image/png" },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toMatchObject({
      type: "image",
      attachmentId: "att_1",
      mime: "image/png",
    });
  });

  it("preserves model provenance", () => {
    const parts = normalizeContentParts([
      {
        type: "image",
        attachmentId: "att_g",
        mime: "image/png",
        source: "model",
        prompt: "a cat",
      },
    ]);
    expect(parts[0]).toEqual({
      type: "image",
      attachmentId: "att_g",
      mime: "image/png",
      source: "model",
      prompt: "a cat",
    });
  });
});

describe("imagePart / textFromParts", () => {
  it("defaults source user", () => {
    expect(imagePart({ attachmentId: "a", mime: "image/png" }).source).toBe(
      "user",
    );
  });

  it("textFromParts ignores images", () => {
    expect(
      textFromParts([
        { type: "text", text: "a" },
        imagePart({ attachmentId: "x", mime: "image/png" }),
      ]),
    ).toBe("a");
  });
});
