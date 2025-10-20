import { adminTest as test, expect } from "../../fixtures/admin-test";

test.describe("Admin bulk operations", () => {
  test("renders queue form and job filters", async ({ adminPage, adminBaseUrl }) => {
    await adminPage.goto(`${adminBaseUrl}/users/bulk`);
    await adminPage.waitForLoadState("networkidle");

    await expect(adminPage.getByRole("heading", { name: "Bulk operations" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Queue a bulk job" })).toBeVisible();
    await expect(adminPage.getByLabel("User identifiers")).toBeVisible();
    await expect(adminPage.getByRole("button", { name: /Queue job/i })).toBeVisible();
  });
});
