import { test, expect } from "../../fixtures/test";

test.describe("Tenant detail view", () => {
  test("supports member and product management flows", async ({ authedPage, ownerSession }) => {
    await authedPage.goto("/tenants");
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
    await authedPage.getByRole("button", { name: "Add member", exact: true }).click();

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

    const permissionToggles = authedPage.locator('[data-testid^="tenant-member-permission-"]');
    if ((await permissionToggles.count()) > 0) {
      const firstToggle = permissionToggles.first();
      await firstToggle.click();
      await expect(firstToggle).toHaveText(/Off/i, { timeout: 5000 });
      await firstToggle.click();
      await expect(firstToggle).toHaveText(/On/i, { timeout: 5000 });
    } else {
      await expect(authedPage.getByText("No apps are enabled for this tenant.")).toBeVisible();
    }

    await authedPage.getByRole("button", { name: "Close" }).click();

    const appToggle = authedPage.locator('[data-testid^="tenant-app-toggle-"]').first();
    const initialState = (await appToggle.textContent())?.trim() ?? "";
    await appToggle.click();
    await expect
      .poll(async () => (await appToggle.textContent())?.trim() ?? "", { timeout: 10_000 })
      .not.toBe(initialState);
    await appToggle.click();
    await expect
      .poll(async () => (await appToggle.textContent())?.trim() ?? "", { timeout: 10_000 })
      .toBe(initialState);
  });
});
