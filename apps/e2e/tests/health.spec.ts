import { test, expect } from "../fixtures/test";

test.describe("Health page", () => {
  test("displays API status for anonymous visitors", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByTestId("health-heading")).toHaveText("API Health");
    await expect(page.getByTestId("health-status")).toBeVisible();
    await expect(page.getByTestId("health-content")).toContainText("API uptime");
  });
});
