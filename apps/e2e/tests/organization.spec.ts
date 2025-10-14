import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe("Tenant management", () => {
  test("shows the management dashboard", async ({ authedPage }) => {
    await authedPage.goto("/tenants");
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.getByRole("heading", { name: "Tenant Management" })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: "Provision tenant" })).toBeVisible();
  });

  test("provisions a new tenant", async ({ authedPage }) => {
    await authedPage.goto("/tenants");
    await authedPage.waitForLoadState("networkidle");

    const tenantName = `Playwright Tenant ${randomUUID().slice(0, 6)}`;

    await authedPage.getByLabel("Tenant name").fill(tenantName);
    await authedPage.getByLabel("Description").fill("E2E tenant created via automation");
    await authedPage.getByRole("button", { name: "Provision tenant" }).click();

    await expect(
      authedPage.getByRole("heading", { level: 2, name: tenantName })
    ).toBeVisible({ timeout: 15000 });
  });
});
