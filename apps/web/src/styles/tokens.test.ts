import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

describe("global design tokens", () => {
  it("defines dark and light theme variables", () => {
    const css = readFileSync(join(dir, "tokens.css"), "utf8");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("--bg-app");
    expect(css).toContain("--accent");
  });

  it("app.css imports tokens and tailwind once", () => {
    const css = readFileSync(join(dir, "app.css"), "utf8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain('@import "./tokens.css"');
  });
});
