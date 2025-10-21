import { test, expect } from "../../fixtures/test";

test.describe("Portal dashboard", () => {
  test("shows key organization metrics", async ({ authedPage }) => {
    await expect(authedPage.getByRole("heading", { name: "Launchpad" })).toBeVisible();
    await expect(
      authedPage.getByText(
        "Keep tabs on privileged activity, bulk job notifications, and quick operational links."
      )
    ).toBeVisible();
    await expect(
      authedPage.getByRole("heading", { name: "Organization snapshot" })
    ).toBeVisible();
    await expect(authedPage.getByText("Tenants you can access.")).toBeVisible();
    await expect(authedPage.getByText("Refresh tokens currently active.")).toBeVisible();
    await expect(authedPage.getByText("Sum of members in all tenants.")).toBeVisible();
  });

  test("navigates to tenants page", async ({ authedPage, ownerSession }) => {
    await authedPage.goto("/tenants");
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.getByRole("heading", { name: "Tenants" })).toBeVisible();
    await expect(
      authedPage
        .getByRole("link")
        .filter({ hasText: ownerSession.organizationName })
    ).toBeVisible({ timeout: 15_000 });
  });
});
