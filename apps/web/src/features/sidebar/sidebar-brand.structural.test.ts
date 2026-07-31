import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION, SOCIAL_LINKS } from "#/lib/app-version";

const root = join(import.meta.dirname, "../..");

describe("product branding surfaces", () => {
  it("sidebar footer exposes version and social links", () => {
    const footer = readFileSync(
      join(import.meta.dirname, "sidebar-brand-footer.tsx"),
      "utf8",
    );
    const nav = readFileSync(
      join(import.meta.dirname, "sidebar-nav.tsx"),
      "utf8",
    );
    expect(footer).toContain("APP_VERSION");
    expect(footer).toContain("SOCIAL_LINKS");
    expect(footer).toContain("/about");
    expect(nav).toContain("SidebarBrandFooter");
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(SOCIAL_LINKS.mjtechguy.href).toContain("x.com/mjtechguy");
    expect(SOCIAL_LINKS.billiondollarsolo.href).toContain(
      "x.com/billiondollarsolo",
    );
  });

  it("about route exists and uses product version", () => {
    const about = readFileSync(join(root, "routes/about.tsx"), "utf8");
    expect(about).toContain("createFileRoute(\"/about\")");
    expect(about).toContain("APP_VERSION");
    expect(about).toContain("SOCIAL_LINKS");
    expect(about).not.toMatch(/ChatGPT|OpenWebUI/i);
  });

  it("sign-in pitch does not name competitor products", () => {
    const auth = readFileSync(
      join(import.meta.dirname, "../auth/auth-split.tsx"),
      "utf8",
    );
    expect(auth).not.toMatch(/ChatGPT|OpenWebUI|Claude/i);
    expect(auth).toMatch(/Your AI workspace/i);
  });
});
