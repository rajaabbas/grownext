import { test, expect } from "../../fixtures/test";

test.describe("Documentation page", () => {
  test("is accessible to anonymous visitors", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Platform Documentation" })).toBeVisible();
    await expect(
      page.getByText("architecture and onboarding guides", { exact: false })
    ).toBeVisible();
    await expect(page.getByRole("list")).toContainText("OIDC flows powered by the Fastify identity service");
  });
});
