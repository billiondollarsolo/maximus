import { describe, expect, it } from "vitest";
import {
  assistantErrorDisplayText,
  isAssistantErrorStatus,
} from "./assistant-error-display";

describe("assistantErrorDisplayText", () => {
  it("returns null for non-error statuses", () => {
    expect(
      assistantErrorDisplayText({
        status: "complete",
        content: [{ type: "text", text: "ok" }],
      }),
    ).toBeNull();
  });

  it("prefers content text when present", () => {
    expect(
      assistantErrorDisplayText({
        status: "error",
        content: [{ type: "text", text: "OpenAI-compat error 400: boom" }],
        error: { message: "other" },
      }),
    ).toBe("OpenAI-compat error 400: boom");
  });

  it("uses error.message when content empty (DB reload shape)", () => {
    expect(
      assistantErrorDisplayText({
        status: "error",
        content: [{ type: "text", text: "" }],
        error: {
          code: "PROVIDER_ERROR",
          message:
            "Unsupported parameter: 'max_tokens' is not supported with this model.",
        },
      }),
    ).toContain("max_tokens");
  });

  it("falls back for empty error object", () => {
    expect(
      assistantErrorDisplayText({
        status: "error",
        content: [],
        error: null,
      }),
    ).toMatch(/Generation failed/i);
  });

  it("aborted without content", () => {
    expect(
      assistantErrorDisplayText({
        status: "aborted",
        content: [],
      }),
    ).toMatch(/stopped/i);
  });
});

describe("isAssistantErrorStatus", () => {
  it("flags error and aborted", () => {
    expect(isAssistantErrorStatus("error")).toBe(true);
    expect(isAssistantErrorStatus("aborted")).toBe(true);
    expect(isAssistantErrorStatus("complete")).toBe(false);
  });
});
