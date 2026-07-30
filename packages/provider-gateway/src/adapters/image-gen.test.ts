import { describe, expect, it } from "vitest";
import { FAKE_PNG_BYTES, generateImage } from "./image-gen.js";

describe("generateImage", () => {
  it("fake returns PNG signature bytes", async () => {
    const out = await generateImage({
      providerKind: "openai",
      modelId: "gpt-image-1",
      prompt: "a cat",
      mode: "fake",
    });
    expect(out.mime).toBe("image/png");
    expect(out.bytes.subarray(0, 8).equals(FAKE_PNG_BYTES.subarray(0, 8))).toBe(
      true,
    );
    // PNG magic
    expect(out.bytes[0]).toBe(0x89);
    expect(out.bytes[1]).toBe(0x50);
    expect(out.bytes[2]).toBe(0x4e);
    expect(out.bytes[3]).toBe(0x47);
  });

  it("live path posts to images/generations", async () => {
    let calledUrl = "";
    let body = "";
    const out = await generateImage({
      providerKind: "openai",
      modelId: "dall-e-3",
      prompt: "cube",
      apiKey: "sk-test",
      mode: "live",
      fetchImpl: async (url, init) => {
        calledUrl = String(url);
        body = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            data: [{ b64_json: FAKE_PNG_BYTES.toString("base64") }],
          }),
          { status: 200 },
        );
      },
    });
    expect(calledUrl).toContain("/images/generations");
    expect(body).toContain("cube");
    expect(out.bytes[0]).toBe(0x89);
  });
});
