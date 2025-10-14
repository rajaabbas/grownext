import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";
import { signupOrganizationOwner } from "../utils/api-client";

test.describe("Signup flow", () => {
  test("creates a new organization via the UI", async ({ page }) => {
    const suffix = randomUUID().slice(0, 6);
    const orgName = `Playwright Org ${suffix}`;
    const fullName = `Tester ${suffix}`;
    const email = `signup.ui.${suffix}@example.com`;
    const password = `P@ssword${suffix}!`;

    await page.goto("/signup");
    await page.getByLabel("Full name").fill(fullName);
    await page.getByLabel("Organization name").fill(orgName);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    let welcomeVisible = false;
    try {
      await page.getByRole("heading", { name: /Welcome back/i }).waitFor({ state: "visible", timeout: 15000 });
      welcomeVisible = true;
    } catch {
      welcomeVisible = false;
    }

    if (welcomeVisible) {
      await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
    } else {
      await expect(
        page.getByText("Check your email to confirm the account", { exact: false })
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test("prevents registering with an existing email", async ({ page }) => {
    const suffix = randomUUID().slice(0, 6);
    const email = `signup.duplicate.${suffix}@example.com`;
    const password = `P@ssw0rd!${suffix}`;

    await signupOrganizationOwner({
      organizationName: `Existing Org ${suffix}`,
      fullName: `Existing User ${suffix}`,
      email,
      password
    });

    await page.goto("/signup");
    await page.getByLabel("Full name").fill(`Duplicate User ${suffix}`);
    await page.getByLabel("Organization name").fill(`Duplicate Org ${suffix}`);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page.getByText(/already/i)).toBeVisible({ timeout: 15000 });
  });
});
