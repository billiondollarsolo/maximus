import { describe, expect, it } from "vitest";
import { assertSafeBaseUrl } from "./ssrf.js";

describe("assertSafeBaseUrl", () => {
  it("allows public https", () => {
    expect(assertSafeBaseUrl("https://api.openai.com/v1").hostname).toBe(
      "api.openai.com",
    );
  });

  it("blocks metadata IP", () => {
    expect(() => assertSafeBaseUrl("http://169.254.169.254/latest")).toThrow(
      /metadata|Private/i,
    );
  });

  it("blocks private without flag", () => {
    expect(() => assertSafeBaseUrl("http://127.0.0.1:11434")).toThrow(/Private/);
  });

  it("allows private when flagged (Ollama docker)", () => {
    expect(
      assertSafeBaseUrl("http://127.0.0.1:11434", { allowPrivate: true }).port,
    ).toBe("11434");
  });

  it("blocks non-http schemes", () => {
    expect(() => assertSafeBaseUrl("file:///etc/passwd")).toThrow(/scheme/);
  });
});
