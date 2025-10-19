import { test, expect } from "../../fixtures/test";

test.describe("Documentation landing page", () => {
  test("is accessible to anonymous visitors", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Platform Documentation", exact: true })).toBeVisible();

    const docsIndex = page.getByRole("list");
    await expect(docsIndex).toContainText("OIDC flows powered by the Fastify identity service");
    await expect(docsIndex).toContainText("Prisma-backed tenant and entitlement models");
    await expect(docsIndex).toContainText("Identity client package for verifying access tokens");
    await expect(docsIndex).toContainText("Supabase integration for user lifecycle and MFA");
  });
});
