import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("theme module", () => {
  it("provider persists via maximus-theme key", () => {
    const src = readFileSync(join(dir, "theme-provider.tsx"), "utf8");
    expect(src).toContain("maximus-theme");
    expect(src).toContain('dataset.theme');
  });
});
