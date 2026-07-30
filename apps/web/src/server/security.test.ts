import { describe, expect, it } from "vitest";
import { AppError } from "@maximus/domain";
import { assertSameOrigin, withSecurityHeaders } from "./security";

describe("withSecurityHeaders", () => {
  it("sets CSP and frame denial", () => {
    const res = withSecurityHeaders(new Response("ok"), { hsts: true });
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age");
  });
});

describe("assertSameOrigin", () => {
  it("allows matching origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3000/api/x", {
          method: "POST",
          headers: { Origin: "http://localhost:3000" },
        }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });

  it("blocks cross-origin POST", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3000/api/x", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
        "http://localhost:3000",
      ),
    ).toThrow(AppError);
  });

  it("skips GET", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3000/api/x", {
          method: "GET",
          headers: { Origin: "https://evil.example" },
        }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });
});
