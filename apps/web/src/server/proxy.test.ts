import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clientIpFromRequest,
  effectiveRequestOrigin,
  publicAppUrl,
  trustProxyEnabled,
} from "./proxy";

describe("proxy trust", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.TRUST_PROXY = "true";
    process.env.TRUSTED_PROXY_HOPS = "1";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("trustProxyEnabled reads env", () => {
    expect(trustProxyEnabled()).toBe(true);
    process.env.TRUST_PROXY = "0";
    expect(trustProxyEnabled()).toBe(false);
  });

  it("clientIpFromRequest uses leftmost X-Forwarded-For when trusted", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(clientIpFromRequest(req)).toBe("203.0.113.10");
  });

  it("prefers cf-connecting-ip", () => {
    const req = new Request("http://localhost/api/x", {
      headers: {
        "cf-connecting-ip": "198.51.100.2",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    expect(clientIpFromRequest(req)).toBe("198.51.100.2");
  });

  it("ignores XFF when TRUST_PROXY off", () => {
    process.env.TRUST_PROXY = "false";
    const req = new Request("http://localhost/api/x", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    expect(clientIpFromRequest(req)).toBeNull();
  });

  it("publicAppUrl uses forwarded proto/host", () => {
    const req = new Request("http://internal:3000/api/x", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "chat.example.com",
      },
    });
    expect(publicAppUrl(req, "http://localhost:3000")).toBe(
      "https://chat.example.com",
    );
  });

  it("effectiveRequestOrigin from forwarded headers", () => {
    const req = new Request("http://internal:3000/api/x", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "chat.example.com",
      },
    });
    expect(effectiveRequestOrigin(req)).toBe("https://chat.example.com");
  });
});
