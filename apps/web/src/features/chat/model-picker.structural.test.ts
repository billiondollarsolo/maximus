import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isLargeLocalModel } from "./large-local-model";

const chatDir = import.meta.dirname;

describe("model picker large-local warning wiring", () => {
  it("ModelSelect binds isLargeLocalModel and warning copy", () => {
    const src = readFileSync(join(chatDir, "model-select.tsx"), "utf8");
    expect(src).toContain("isLargeLocalModel");
    expect(src).toContain("LARGE_LOCAL_MODEL_WARNING");
    expect(src).toContain("Slow first token");
    expect(src).toContain("First token may take 1–2 min");
  });

  it("heuristic matches shipped helper", () => {
    expect(isLargeLocalModel("ollama:c:gemma4:31b")).toBe(true);
    expect(isLargeLocalModel("ollama:c:gemma3:4b")).toBe(false);
  });
});
