import { expect, test } from "../../fixtures/test";

test.describe("Authentication", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /Sign in to GrowNext/i })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/i })).toBeEnabled();
  });
});
