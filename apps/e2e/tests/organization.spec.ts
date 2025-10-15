import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe("Tenant management", () => {
  test("adds a new tenant from the dashboard dialog", async ({ authedPage }) => {
    const tenantName = `Playwright Tenant ${randomUUID().slice(0, 6)}`;

    const addButton = authedPage.getByRole("button", { name: "Add tenants" });
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(authedPage.getByRole("heading", { name: "Add tenant" })).toBeVisible();

    await authedPage.getByLabel("Tenant name").fill(tenantName);
    await authedPage.getByLabel("Description").fill("E2E tenant created via automation");
    await authedPage.getByRole("button", { name: "Provision tenant" }).click();

    await expect(authedPage.getByRole("heading", { name: "Add tenant" })).toHaveCount(0);
    await authedPage.waitForLoadState("networkidle");

    await expect(
      authedPage
        .getByRole("link")
        .filter({ hasText: tenantName })
    ).toBeVisible({ timeout: 20000 });
  });
});
