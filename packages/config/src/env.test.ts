import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("fails when DATABASE_URL is missing in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_URL: "https://maximus.example",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("succeeds with a full production fixture", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      APP_URL: "https://maximus.example",
      DATABASE_URL: "postgres://maximus:maximus@localhost:5432/maximus",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.DATABASE_URL).toContain("postgres://");
    expect(env.APP_URL).toBe("https://maximus.example");
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const env = parseEnv({
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://maximus:maximus@localhost:5432/maximus",
    });

    expect(env.NODE_ENV).toBe("development");
  });

  it("allows missing DATABASE_URL outside production", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
    });

    expect(env.DATABASE_URL).toBeUndefined();
  });
});
