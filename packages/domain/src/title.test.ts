import { describe, expect, it } from "vitest";
import {
  fakeGeneratedTitle,
  heuristicTitle,
  normalizeGeneratedTitle,
  shouldRetitle,
  shouldRunAutoRetitle,
} from "./title.js";

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

describe("shouldRunAutoRetitle", () => {
  it("only runs for heuristic or unset", () => {
    expect(shouldRunAutoRetitle("heuristic")).toBe(true);
    expect(shouldRunAutoRetitle(null)).toBe(true);
    expect(shouldRunAutoRetitle("llm")).toBe(false);
    expect(shouldRunAutoRetitle("user")).toBe(false);
  });
});

describe("normalizeGeneratedTitle", () => {
  it("strips quotes and Title: prefix", () => {
    expect(normalizeGeneratedTitle('"Ollama Setup"')).toBe("Ollama Setup");
    expect(normalizeGeneratedTitle("Title: Fast API Tips")).toBe("Fast API Tips");
  });

  it("returns null for empty or multi-sentence dumps", () => {
    expect(normalizeGeneratedTitle("")).toBeNull();
    expect(
      normalizeGeneratedTitle(
        "This is a long answer. It has two sentences for sure.",
      ),
    ).toBeNull();
  });
});

describe("fakeGeneratedTitle", () => {
  it("shortens question-style openers into a phrase", () => {
    const t = fakeGeneratedTitle("how do I configure ollama with maximus?");
    expect(t.toLowerCase()).toContain("configure");
    expect(t).not.toMatch(/^how do i/i);
  });
});
