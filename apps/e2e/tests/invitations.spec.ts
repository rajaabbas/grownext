import { test, expect } from "../fixtures/test";

test.describe("Tenant actions", () => {
  test("surfaces invite and product controls for each tenant", async ({ authedPage }) => {
    await authedPage.goto("/tenants");
    await authedPage.waitForLoadState("networkidle");

    const inviteButtons = authedPage.getByRole("button", { name: "Invite member" });
    await expect(inviteButtons.first()).toBeVisible();

    const enableButtons = authedPage.getByRole("button", { name: "Enable product" });
    const allEnabledMessage = authedPage.getByText("All available products are enabled");
    const noProductsMessage = authedPage.getByText("No products available");

    if (await enableButtons.count()) {
      await expect(enableButtons.first()).toBeVisible();
    } else if (await allEnabledMessage.count()) {
      await expect(allEnabledMessage.first()).toBeVisible();
    } else {
      await expect(noProductsMessage.first()).toBeVisible();
    }
  });
});
