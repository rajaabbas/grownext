import { randomUUID } from "crypto";
import { test, expect } from "../../fixtures/test";
import { signupOrganizationOwner } from "../../utils/api-client";

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
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Launchpad" })).toBeVisible({
      timeout: 15_000
    });
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
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page.getByText("User already registered")).toBeVisible({ timeout: 15000 });
  });
});
