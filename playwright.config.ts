import { defineConfig, devices } from "@playwright/test";

// Avoid 4173 — often taken by other local previews
const port = Number(process.env.E2E_PORT ?? 4317);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `pnpm --filter @maximus/web exec vite dev --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PROVIDER_MODE: "fake",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://maximus:maximus@localhost:5432/maximus",
      VALKEY_URL: process.env.VALKEY_URL ?? "redis://localhost:6379",
      APP_URL: baseURL,
      ENCRYPTION_KEY:
        process.env.ENCRYPTION_KEY ??
        Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
    },
  },
});
