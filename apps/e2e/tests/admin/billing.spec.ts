import { adminTest as test, expect } from "../../fixtures/admin-test";

test.describe("Admin billing workflows", () => {
  test("shows billing overview metrics", async ({ adminPage }) => {
    await adminPage.goto("/billing");
    await expect(adminPage.getByText("Active packages")).toBeVisible();
    await expect(adminPage.getByText("Active subscriptions")).toBeVisible();
    await expect(adminPage.getByText("Outstanding balance")).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Recent invoices" })).toBeVisible();
  });

  test("lists catalog packages and exposes creation form", async ({ adminPage }) => {
    await adminPage.goto("/billing/catalog");

    await adminPage.getByRole("button", { name: "Create a new package" }).click();
    await expect(adminPage.getByLabel("Slug")).toBeVisible();
    await expect(adminPage.getByRole("table")).toContainText("Starter");
  });

  test("filters usage analytics by feature key", async ({ adminPage }) => {
    await adminPage.goto("/billing/usage");

    await adminPage.getByLabel("Feature key").fill("ai.tokens");
    await adminPage.getByRole("button", { name: "Apply filters" }).click();
    await adminPage.waitForLoadState("networkidle");

    await expect(adminPage.getByRole("table")).toContainText("ai.tokens");
  });

  test("renders invoice review table", async ({ adminPage }) => {
    await adminPage.goto("/billing/invoices");
    await expect(adminPage.getByRole("heading", { name: "Invoice review" })).toBeVisible();
    await expect(adminPage.getByRole("table")).toBeVisible();
  });
});
