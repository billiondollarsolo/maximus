import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("teams + access UI structural", () => {
  it("Members admin has teams management including remove member", () => {
    const src = read("features/admin/members-admin.tsx");
    expect(src).toContain("People");
    expect(src).toContain("New team");
    expect(src).toContain("/api/admin/teams");
    expect(src).toContain("Add member");
    expect(src).toContain("remove_member");
    expect(src).toMatch(/Remove/);
  });

  it("admin nav labels People", () => {
    const src = read("features/admin/admin-shell.tsx");
    expect(src).toContain('label: "People"');
  });

  it("Access admin has mode + grants with pickers", () => {
    const src = read("features/admin/access-admin.tsx");
    expect(src).toContain("accessMode");
    expect(src).toContain("/api/admin/access-grants");
    expect(src).toContain("Add grant");
    expect(src).toContain("subjectType");
    expect(src).toContain("Select model");
  });

  it("access-grants GET offerings use buildModelCatalog (platform+org)", () => {
    const src = read("routes/api/admin/access-grants.ts");
    expect(src).toContain("buildModelCatalog");
    expect(src).toContain("composed.catalog");
    expect(src).not.toMatch(
      /listModels\(db,\s*ctx\.orgId\)[\s\S]*offerings:\s*models\.map/,
    );
  });

  it("user menu has conditional org switcher", () => {
    const src = read("features/sidebar/sidebar-user-menu.tsx");
    expect(src).toContain("orgs.length >= 2");
    expect(src).toContain("/api/auth/context");
    expect(src).toContain("Organization");
  });

  it("no create-org control in user menu", () => {
    const src = read("features/sidebar/sidebar-user-menu.tsx");
    expect(src.toLowerCase()).not.toContain("create org");
    expect(src).not.toContain("create organization");
  });

  it("API routes exist", () => {
    expect(existsSync(join(root, "routes/api/admin/teams.ts"))).toBe(true);
    expect(existsSync(join(root, "routes/api/admin/access-grants.ts"))).toBe(
      true,
    );
    expect(existsSync(join(root, "routes/api/auth/context.ts"))).toBe(true);
  });
});
