import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe("Password reset", () => {
  test("allows users to request a reset email", async ({ page }) => {
    const email = `reset.${randomUUID().slice(0, 6)}@example.com`;

    await page.goto("/auth/reset-password");
    await expect(page.getByTestId("password-reset-heading")).toBeVisible();

    await page.getByTestId("password-reset-email").fill(email);
    await page.getByTestId("password-reset-submit").click();

    await expect(page.getByTestId("password-reset-message")).toContainText(
      "If an account exists for that email"
    );
    const devLink = page.getByTestId("password-reset-link");
    if (await devLink.count()) {
      await expect(devLink).toBeVisible();
    }
  });
});
