import { adminTest as test, expect } from "../../fixtures/admin-test";

test.describe("Admin dashboard", () => {
  test("surfaces quick links and audit snapshot", async ({ adminPage }) => {
    await expect(adminPage.getByRole("heading", { name: "Welcome to the Super Admin console" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Manage Users" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Bulk Operations" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Latest audit activity" })).toBeVisible();
  });
});
