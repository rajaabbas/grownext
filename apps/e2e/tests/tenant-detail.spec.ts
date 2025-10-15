import { test, expect } from "../fixtures/test";

test.describe("Tenant detail view", () => {
  test("supports member and product management flows", async ({ authedPage, ownerSession }) => {
    await authedPage.waitForLoadState("networkidle");

    const defaultTenantName = `${ownerSession.organizationName} Workspace`;
    await authedPage
      .getByRole("link")
      .filter({ hasText: defaultTenantName })
      .first()
      .click();
    await authedPage.waitForURL("**/tenants/**");

    await expect(authedPage.getByLabel("Tenant name")).toHaveValue(defaultTenantName);

    const memberRow = () =>
      authedPage.getByRole("row", { name: new RegExp(ownerSession.fullName, "i") }).first();

    await expect(memberRow()).toBeVisible();

    await memberRow()
      .getByRole("combobox", { name: `Tenant role for ${ownerSession.fullName}` })
      .selectOption("MEMBER");

    await expect(
      memberRow().getByRole("combobox", { name: `Tenant role for ${ownerSession.fullName}` })
    ).toHaveValue("MEMBER");

    await memberRow().getByRole("button", { name: "Remove" }).click();

    await expect(authedPage.getByText(/No members yet/i)).toBeVisible();

    await authedPage.getByRole("button", { name: "Add members" }).click();
    await expect(authedPage.getByRole("heading", { name: "Add tenant member" })).toBeVisible();

    await authedPage.getByLabel("Tenant role").selectOption("ADMIN");
    await authedPage.getByRole("button", { name: "Add member" }).click();

    await expect(authedPage.getByText("Member added")).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Add tenant member" })).toHaveCount(0);
    await expect(memberRow()).toBeVisible();

    await memberRow()
      .getByRole("combobox", { name: `Tenant role for ${ownerSession.fullName}` })
      .selectOption("ADMIN");

    await expect(
      memberRow().getByRole("combobox", { name: `Tenant role for ${ownerSession.fullName}` })
    ).toHaveValue("ADMIN");

    await memberRow().getByRole("button", { name: "Permissions" }).click();
    const permissionsDialog = authedPage.getByRole("heading", { name: "Permissions" });
    await expect(permissionsDialog).toBeVisible();

    const firstPermissionToggle = authedPage
      .locator('[data-testid^="tenant-member-permission-"]')
      .first();
    await firstPermissionToggle.click();
    await expect(firstPermissionToggle).toHaveText(/Off/i, { timeout: 5000 });
    await firstPermissionToggle.click();
    await expect(firstPermissionToggle).toHaveText(/On/i, { timeout: 5000 });
    await authedPage.getByRole("button", { name: "Close" }).click();

    const appToggle = authedPage.locator('[data-testid^="tenant-app-toggle-"]').first();
    await appToggle.click();
    await expect(appToggle).toHaveText(/Off/i, { timeout: 5000 });
    await expect(
      authedPage.getByText(/No members currently have access to this app/i)
    ).toBeVisible();
    await appToggle.click();
    await expect(appToggle).toHaveText(/On/i, { timeout: 5000 });
  });
});
