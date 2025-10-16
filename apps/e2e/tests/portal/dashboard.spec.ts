import { test, expect } from "../../fixtures/test";

test.describe("Portal dashboard", () => {
  test("shows key organization metrics", async ({ authedPage }) => {
    await expect(authedPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(authedPage.getByText("High level summary of your organization activity.")).toBeVisible();
    await expect(authedPage.getByText("Total workspaces you can access")).toBeVisible();
    await expect(authedPage.getByText("Active sessions")).toBeVisible();
    await expect(authedPage.getByText("Members across tenants")).toBeVisible();
  });

  test("navigates to tenants page", async ({ authedPage, ownerSession }) => {
    await authedPage.goto("/tenants");
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.getByRole("heading", { name: "Tenants" })).toBeVisible();
    await expect(
      authedPage
        .getByRole("link")
        .filter({ hasText: `${ownerSession.organizationName} Workspace` })
    ).toBeVisible({ timeout: 15_000 });
  });
});
