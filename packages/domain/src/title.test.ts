import { describe, expect, it } from "vitest";
import { heuristicTitle, shouldRetitle } from "./title.js";

describe("heuristicTitle", () => {
  it("returns a short title from plain text", () => {
    expect(heuristicTitle("hello world")).toBe("hello world");
  });

  it("collapses whitespace and trims", () => {
    expect(heuristicTitle("  hello   \n world  ")).toBe("hello world");
  });

  it("truncates long input at 60 chars without breaking mid-word when possible", () => {
    const long =
      "This is a very long conversation starter that should be shortened for the sidebar title display area";
    const title = heuristicTitle(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…") || title.length <= 60).toBe(true);
  });

  it("returns New chat for empty input", () => {
    expect(heuristicTitle("")).toBe("New chat");
    expect(heuristicTitle("   ")).toBe("New chat");
  });
});

describe("shouldRetitle", () => {
  it("allows retitle for heuristic and llm sources", () => {
    expect(shouldRetitle("heuristic")).toBe(true);
    expect(shouldRetitle("llm")).toBe(true);
    expect(shouldRetitle(null)).toBe(true);
  });

  it("never retitles when user set the title", () => {
    expect(shouldRetitle("user")).toBe(false);
  });
});
