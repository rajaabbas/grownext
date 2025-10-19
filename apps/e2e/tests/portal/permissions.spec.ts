import { expect, test } from "../../fixtures/test";

test.describe("Portal permissions", () => {
  test("renders the default role catalog", async ({ authedPage }) => {
    await authedPage.goto("/permissions");
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.getByRole("heading", { name: "Permissions", exact: true })).toBeVisible();
    await expect(authedPage.getByText("Defined roles")).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Owner" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Admin" })).toBeVisible();
  });

  test("allows toggling permissions for the manager role", async ({ authedPage }) => {
    await authedPage.goto("/permissions");
    await authedPage.waitForLoadState("networkidle");

    const roleName = "Manager";
    const roleHeading = authedPage.getByRole("heading", { name: roleName, exact: true });
    await expect(roleHeading).toBeVisible();

    const rolePanel = authedPage
      .locator("details")
      .filter({ has: authedPage.locator("summary", { hasText: roleName }) })
      .first();
    const permissionToggle = rolePanel.getByLabel("Enable tenant applications");
    await permissionToggle.scrollIntoViewIfNeeded();
    const initialState = await permissionToggle.isChecked();

    const permissionLabel = rolePanel.locator("label").filter({ hasText: "Enable tenant applications" }).first();

    await permissionLabel.click();
    await expect(permissionToggle).toHaveJSProperty("checked", !initialState);

    // restore the original role configuration
    await permissionLabel.click();
    await expect(permissionToggle).toHaveJSProperty("checked", initialState);

    await rolePanel.locator("summary").click();
  });
});
