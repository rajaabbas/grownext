import { test, expect } from "../../fixtures/test";

test.describe("Documentation landing page", () => {
  test("is accessible to anonymous visitors", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "GrowNext Platform Documentation" })).toBeVisible();

    const docsIndex = page.getByRole("list");
    await expect(docsIndex).toContainText("identity, portal, product interactions");
    await expect(docsIndex).toContainText("production-readiness");
    await expect(docsIndex).toContainText("roadmap");
  });
});
