import { expect, test } from "../fixtures/test";

test.describe("MFA guidance", () => {
  test("explains how to enroll in multi-factor authentication", async ({ page }) => {
    await page.goto("/mfa");

    await expect(page.getByRole("heading", { name: "Multi-factor Authentication" })).toBeVisible();
    await expect(page.getByText("authenticator app", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate recovery codes" })).toBeVisible();
  });
});
