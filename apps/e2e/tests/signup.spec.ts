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
    await page.getByTestId("signup-organization-name").fill(orgName);
    await page.getByTestId("signup-full-name").fill(fullName);
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm-password").fill(password);
    await page.getByTestId("signup-submit").click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-heading")).toBeVisible();

    const alert = page.getByTestId("dashboard-email-alert");
    if ((await alert.count()) > 0) {
      await expect(alert).toBeVisible();
    }
  });

  test("shows an error when passwords do not match", async ({ page }) => {
    const suffix = randomUUID().slice(0, 6);

    await page.goto("/signup");
    await page.getByTestId("signup-organization-name").fill(`Mismatch Org ${suffix}`);
    await page.getByTestId("signup-full-name").fill(`Mismatch User ${suffix}`);
    await page.getByTestId("signup-email").fill(`signup.mismatch.${suffix}@example.com`);
    await page.getByTestId("signup-password").fill("Password123!");
    await page.getByTestId("signup-confirm-password").fill("Password987!");
    await page.getByTestId("signup-submit").click();

    await expect(page.getByTestId("signup-message")).toContainText("Passwords do not match");
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
    await page.getByTestId("signup-organization-name").fill(`Duplicate Org ${suffix}`);
    await page.getByTestId("signup-full-name").fill(`Duplicate User ${suffix}`);
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm-password").fill(password);
    await page.getByTestId("signup-submit").click();

    await expect(page.getByTestId("signup-message")).toContainText(
      "An account with this email already exists"
    );
  });
});
