import { expect, test } from "../fixtures/test";

test.describe("Authentication", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("login-heading")).toBeVisible();
    await expect(page.getByTestId("login-email")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toBeEnabled();
  });
});
