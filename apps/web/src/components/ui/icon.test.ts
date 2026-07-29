import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("Icon wrapper", () => {
  it("accepts a LucideIcon and defaults decorative aria-hidden", () => {
    const src = readFileSync(join(dir, "icon.tsx"), "utf8");
    expect(src).toContain("LucideIcon");
    expect(src).toContain("decorative");
    expect(src).toContain("aria-hidden");
  });
});
