import { test, expect } from "../fixtures/test";

test.describe("Profile page", () => {
  test("displays account details and active sessions", async ({ authedPage, ownerSession }) => {
    await authedPage.goto("/profile");
    await authedPage.waitForLoadState("networkidle");

    const main = authedPage.getByRole("main");
    await expect(main.getByRole("heading", { name: "Profile & Security" })).toBeVisible();
    await expect(main.getByText(ownerSession.email).first()).toBeVisible();
    await expect(main.getByRole("heading", { name: "Active Sessions" })).toBeVisible();

    const revokeButton = main.getByRole("button", { name: /Revoke/i }).first();
    if ((await revokeButton.count()) > 0) {
      await revokeButton.click();
      await expect(revokeButton).toHaveText(/Revoking.../);
      await expect(revokeButton).toHaveText(/Revoke/);
    } else {
      await expect(main.getByText("No active sessions found.")).toBeVisible();
    }

    await authedPage.goBack();
  });
});
