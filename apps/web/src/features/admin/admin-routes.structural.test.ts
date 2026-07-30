import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const features = join(import.meta.dirname);

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function readFeature(name: string) {
  return readFileSync(join(features, name), "utf8");
}

describe("admin console cohesion", () => {
  it("ships shared enterprise primitives", () => {
    expect(existsSync(join(root, "components/ui/dialog.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/data-table.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/switch.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/select.tsx"))).toBe(true);
    expect(existsSync(join(features, "page-header.tsx"))).toBe(true);
    expect(existsSync(join(features, "confirm-dialog.tsx"))).toBe(true);
    expect(existsSync(join(features, "admin-section.tsx"))).toBe(true);
    expect(existsSync(join(features, "admin-alert.tsx"))).toBe(true);
  });

  it("global CSS defines admin density classes", () => {
    const css = read("styles/app.css");
    expect(css).toContain(".admin-shell");
    expect(css).toContain(".admin-nav-link");
    expect(css).toContain(".field-control");
    expect(css).toContain(".admin-section");
    expect(css).toContain(".admin-stat-card");
  });

  it("every admin page uses shell + feature modules", () => {
    for (const f of [
      "routes/admin.index.tsx",
      "routes/admin.members.tsx",
      "routes/admin.providers.tsx",
      "routes/admin.models.tsx",
      "routes/admin.usage.tsx",
      "routes/admin.audit.tsx",
    ]) {
      const src = read(f);
      expect(src).toContain("AdminShell");
      expect(src).toContain("AdminGateFrame");
    }
    expect(read("routes/admin.index.tsx")).toContain("OverviewDashboard");
    expect(read("routes/admin.members.tsx")).toContain("MembersAdmin");
    expect(read("routes/admin.providers.tsx")).toContain("ProvidersAdmin");
    expect(read("routes/admin.models.tsx")).toContain("AccessAdmin");
    expect(read("routes/admin.usage.tsx")).toContain("UsageAdmin");
    expect(read("routes/admin.audit.tsx")).toContain("AuditAdmin");
  });

  it("list pages use DataTable + page header CTA pattern", () => {
    for (const f of [
      "providers-admin.tsx",
      "members-admin.tsx",
      "access-admin.tsx",
      "usage-admin.tsx",
      "audit-admin.tsx",
    ]) {
      const src = readFeature(f);
      expect(src).toContain("DataTable");
      expect(src).toContain("AdminPageHeader");
    }
    expect(readFeature("providers-admin.tsx")).toContain("Add provider");
    expect(readFeature("members-admin.tsx")).toContain("Invite member");
    expect(readFeature("access-admin.tsx")).toContain("ConfirmDialog");
    expect(readFeature("providers-admin.tsx")).toContain("ConfirmDialog");
  });

  it("admin nav has no standalone Pricing label", () => {
    const src = readFeature("admin-shell.tsx");
    expect(src).toContain("Providers");
    expect(src).toContain("Access");
    expect(src).not.toContain("Pricing");
  });

  it("settings shell reuses admin-nav-link density", () => {
    const src = readFileSync(
      join(root, "features/settings/settings-shell.tsx"),
      "utf8",
    );
    expect(src).toContain("admin-nav-link");
    expect(src).toContain("admin-shell");
  });
});
