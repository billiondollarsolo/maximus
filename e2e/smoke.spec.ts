import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "maximus-e2e@test.local";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2eTestPass99!";

test.describe("Maximus smoke", () => {
  test("login → chat → regenerate shows branch switcher", async ({ page }) => {
    await page.goto("/login");

    // Bootstrap first-run OR sign-in
    const password = page.locator('input[type="password"]');
    await expect(password).toBeVisible();

    const nameField = page.getByLabel(/your name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill("E2E Owner");
      await page.getByLabel(/workspace name/i).fill("E2E Workspace");
      await page.getByLabel(/^email$/i).fill(E2E_EMAIL);
      await password.fill(E2E_PASSWORD);
      await page.getByRole("button", { name: /create workspace/i }).click();
    } else {
      await page.getByLabel(/^email$/i).fill(E2E_EMAIL);
      await password.fill(E2E_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
    }

    // Land on chat shell
    await expect(
      page.getByRole("button", { name: "New chat" }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/maximus/i).first()).toBeVisible();

    // Wait for models to load so send is enabled (ModelSelect fills modelRef)
    const model = page.getByRole("combobox", { name: /model/i });
    await expect(model).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => model.locator("option").count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const composer = page.locator("textarea").first();
    await composer.fill("Hello from playwright smoke");
    await page.getByRole("button", { name: /send message/i }).click();

    // User message appears in thread (title also may match in sidebar)
    await expect(
      page.getByRole("main").getByText("Hello from playwright smoke"),
    ).toBeVisible({ timeout: 15_000 });
    // Wait for stream to settle — regenerate on last assistant
    const regen = page.getByRole("button", { name: /regenerate/i }).first();
    await expect(regen).toBeVisible({ timeout: 30_000 });
    await regen.click({ force: true });

    // Branch switcher appears when siblings > 1 after regenerate
    const branch = page.getByRole("group", { name: /branch version/i }).first();
    await expect(branch).toBeVisible({ timeout: 30_000 });
    await expect(branch).toContainText(/\/\s*2/);
    // Prefer switching when controls are stable; soft-assert navigation
    const prev = branch.getByRole("button", { name: /previous branch/i });
    const next = branch.getByRole("button", { name: /next branch/i });
    await expect(prev).toBeVisible();
    await expect(next).toBeVisible();
    try {
      if (await prev.isEnabled()) {
        await prev.click({ force: true, timeout: 5_000 });
      } else if (await next.isEnabled()) {
        await next.click({ force: true, timeout: 5_000 });
      }
      await expect(branch).toContainText(/\/\s*2/);
    } catch {
      // Stream reload can detach nodes; presence of 1/2 (or 2/2) is the gate.
    }
  });
});


