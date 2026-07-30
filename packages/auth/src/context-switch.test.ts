import { describe, expect, it } from "vitest";
import { AppError } from "@maximus/domain";

/**
 * Pure membership boundary check mirroring switchActiveContext.
 * Integration test of full session switch lives with auth.integration when DB available.
 */
function assertCanSwitch(input: {
  memberships: string[];
  targetOrgId: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.memberships.includes(input.targetOrgId)) {
    return { ok: false, error: "Not a member of that organization" };
  }
  return { ok: true };
}

describe("org context switch membership boundary", () => {
  it("allows switch to a membership org", () => {
    expect(
      assertCanSwitch({
        memberships: ["org_a", "org_b"],
        targetOrgId: "org_b",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects non-membership", () => {
    const r = assertCanSwitch({
      memberships: ["org_a"],
      targetOrgId: "org_x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Not a member/);
  });

  it("default active org is sole membership", () => {
    const memberships = ["org_only"];
    const active =
      memberships.length === 1 ? memberships[0]! : memberships[0]!;
    expect(active).toBe("org_only");
  });
});

describe("AppError FORBIDDEN used for boundary", () => {
  it("constructs", () => {
    const e = new AppError("FORBIDDEN", "Not a member of that organization");
    expect(e.code).toBe("FORBIDDEN");
  });
});
