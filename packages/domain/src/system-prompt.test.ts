import { describe, expect, it } from "vitest";
import { assembleSystemPrompts } from "./system-prompt.js";

describe("assembleSystemPrompts", () => {
  it("orders platform → org → project → user", () => {
    expect(
      assembleSystemPrompts({
        platform: "p",
        org: "o",
        project: "proj",
        userAbout: "dev",
        userPreferred: "concise",
      }),
    ).toEqual([
      "p",
      "o",
      "proj",
      "About the user: dev\nPreferred response style: concise",
    ]);
  });

  it("skips empty segments", () => {
    expect(assembleSystemPrompts({ platform: "  ", org: "o" })).toEqual(["o"]);
  });
});
