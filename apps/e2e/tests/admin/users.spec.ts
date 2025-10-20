import { adminTest as test, expect } from "../../fixtures/admin-test";

test.describe("Admin user directory", () => {
  test("allows navigation to global directory", async ({ adminPage, adminBaseUrl }) => {
    await adminPage.goto(`${adminBaseUrl}/users`);
    await adminPage.waitForLoadState("networkidle");

    await expect(adminPage.getByRole("heading", { name: "Global user directory" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: /Launch bulk operations/i })).toBeVisible();
  });
});
