import { describe, expect, it } from "vitest";
import { sessionFromRequest, SESSION_COOKIE } from "./cookies";

describe("sessionFromRequest", () => {
  it("reads cookie", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { cookie: `${SESSION_COOKIE}=tok-cookie` },
    });
    expect(sessionFromRequest(req)).toBe("tok-cookie");
  });

  it("prefers Authorization Bearer", () => {
    const req = new Request("http://localhost/api/x", {
      headers: {
        authorization: "Bearer tok-bearer",
        cookie: `${SESSION_COOKIE}=tok-cookie`,
      },
    });
    expect(sessionFromRequest(req)).toBe("tok-bearer");
  });

  it("reads X-Session-Token", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { "x-session-token": "tok-header" },
    });
    expect(sessionFromRequest(req)).toBe("tok-header");
  });

  it("returns null when absent", () => {
    expect(sessionFromRequest(new Request("http://localhost/api/x"))).toBeNull();
  });
});
