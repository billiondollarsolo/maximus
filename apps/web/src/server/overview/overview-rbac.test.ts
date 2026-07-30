import { describe, expect, it } from "vitest";
import { requireOrgRole } from "@maximus/auth";
import { AppError } from "@maximus/domain";

/**
 * Handler-level RBAC contract for overview APIs:
 * admin allowed, member forbidden (403).
 */
describe("overview admin RBAC", () => {
  const adminCtx = {
    user: { id: "u1", email: "a@t.local", name: "A" },
    orgId: "org1",
    role: "admin" as const,
    sessionToken: "t",
  };

  const memberCtx = {
    ...adminCtx,
    role: "member" as const,
  };

  it("admin passes requireOrgRole(admin)", () => {
    expect(() => requireOrgRole(adminCtx as never, "admin")).not.toThrow();
  });

  it("member is FORBIDDEN (403)", () => {
    try {
      requireOrgRole(memberCtx as never, "admin");
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: "FORBIDDEN", status: 403 });
    }
  });
});
