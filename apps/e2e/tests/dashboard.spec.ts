import { test, expect } from "../fixtures/test";

test.describe("Portal launcher", () => {
  test("shows the welcome banner and tenant overview", async ({ authedPage, ownerSession }) => {
    await expect(authedPage.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(authedPage.getByText(ownerSession.email)).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Tenants" })).toBeVisible();
    await expect(authedPage.getByRole("link", { name: /Manage tenants/i })).toBeVisible();
  });

  test("navigates to tenant management from the launcher", async ({ authedPage }) => {
    await authedPage.getByRole("link", { name: /Manage tenants/i }).click();
    await authedPage.waitForURL("**/tenants");
    await expect(authedPage.getByRole("heading", { name: /Tenant Management/i })).toBeVisible();
  });
});
