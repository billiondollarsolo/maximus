import { describe, expect, it } from "vitest";
import { AppError } from "@maximus/domain";
import { requireOrgRole, type AuthContext } from "./session.js";

describe("member denied admin", () => {
  const member: AuthContext = {
    user: { id: "u", email: "m@t.local", name: "M" },
    orgId: "o",
    role: "member",
    sessionToken: "s",
  };

  it("requireOrgRole admin throws FORBIDDEN for member", () => {
    expect(() => requireOrgRole(member, "admin")).toThrow(AppError);
    try {
      requireOrgRole(member, "admin");
    } catch (e) {
      expect(e).toMatchObject({ code: "FORBIDDEN", status: 403 });
    }
  });

  it("owner passes admin check", () => {
    expect(() =>
      requireOrgRole({ ...member, role: "owner" }, "admin"),
    ).not.toThrow();
  });
});
