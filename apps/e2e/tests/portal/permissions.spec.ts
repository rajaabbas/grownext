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

  test("allows creating a custom role and toggling permissions", async ({ authedPage }) => {
    await authedPage.goto("/permissions");
    await authedPage.waitForLoadState("networkidle");

    const roleName = "Support Lead";
    await authedPage.getByLabel("Role name").fill(roleName);
    await authedPage.getByLabel("Description").fill("Handles escalations and tenant management.");
    await authedPage.getByRole("button", { name: "Add role" }).click();

    const roleCard = authedPage.getByRole("heading", { name: roleName, exact: true });
    await expect(roleCard).toBeVisible();

    const rolePanel = authedPage
      .locator("details")
      .filter({ has: authedPage.locator("summary", { hasText: roleName }) })
      .first();
    const roleSection = rolePanel.locator("summary");
    await roleSection.click();

    const permissionToggle = rolePanel.getByLabel("View organization profile", { exact: false });
    await permissionToggle.check();
    await expect(permissionToggle).toBeChecked();

    await roleSection.click(); // collapse to refresh summary counts
    const roleSummaryCard = authedPage.locator("article").filter({ has: roleCard });
    await expect(roleSummaryCard.getByText("1 organization permissions")).toBeVisible();
  });
});
