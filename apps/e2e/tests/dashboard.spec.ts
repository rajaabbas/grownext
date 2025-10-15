import { test, expect } from "../fixtures/test";

test.describe("Portal dashboard", () => {
  test("shows tenant grid and add tenants action", async ({ authedPage }) => {
    await expect(authedPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Tenants" })).toBeVisible();
    const addButton = authedPage.getByRole("button", { name: "Add tenants" });
    await expect(addButton).toBeVisible();

    await addButton.click();
    const dialogHeading = authedPage.getByRole("heading", { name: "Add tenant" });
    await expect(dialogHeading).toBeVisible();
    await authedPage.getByRole("button", { name: "Close add tenant dialog" }).click();
    await expect(dialogHeading).toHaveCount(0);
  });

  test("opens tenant details from a dashboard card", async ({ authedPage, ownerSession }) => {
    const defaultTenantName = `${ownerSession.organizationName} Workspace`;
    await authedPage
      .getByRole("link")
      .filter({ hasText: defaultTenantName })
      .first()
      .click();
    await authedPage.waitForURL("**/tenants/**");
    await expect(authedPage.getByLabel("Tenant name")).toHaveValue(defaultTenantName);
  });
});
