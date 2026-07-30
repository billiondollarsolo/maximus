import { describe, expect, it } from "vitest";
import {
  prepareStreamingMarkdown,
  textFromReactChildren,
} from "./stream-markdown";

describe("prepareStreamingMarkdown", () => {
  it("leaves complete fences alone", () => {
    const src = "before\n```ts\nconst x = 1\n```\nafter";
    expect(prepareStreamingMarkdown(src)).toBe(src);
  });

  it("closes an open fence for streaming", () => {
    const src = "intro\n```python\nprint(1";
    expect(prepareStreamingMarkdown(src)).toBe(`${src}\n\`\`\``);
  });

  it("handles empty string", () => {
    expect(prepareStreamingMarkdown("")).toBe("");
  });
});

describe("textFromReactChildren", () => {
  it("flattens nested children", () => {
    expect(
      textFromReactChildren([
        "a",
        { props: { children: ["b", { props: { children: "c" } }] } },
      ]),
    ).toBe("abc");
  });
});
