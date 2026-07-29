import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "rate-limit",
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
