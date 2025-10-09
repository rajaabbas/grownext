import { test, expect } from "../fixtures/test";
import { hasSupabaseAdmin, markUserEmailVerified } from "../utils/supabase-admin";

test.describe("Dashboard", () => {
  test("shows the email verification reminder for new accounts", async ({ authedPage }) => {
    await expect(authedPage.getByTestId("dashboard-heading")).toBeVisible();
    await expect(authedPage.getByTestId("dashboard-email-alert")).toBeVisible();
  });

  test("hides the reminder once the email is verified", async ({ page, ownerSession }, testInfo) => {
    if (!hasSupabaseAdmin) {
      testInfo.skip("Supabase admin credentials not provided");
    }

    await markUserEmailVerified(ownerSession.userId);

    await page.goto("/login");
    await page.getByTestId("login-email").fill(ownerSession.email);
    await page.getByTestId("login-password").fill(ownerSession.password);
    await page.getByTestId("login-submit").click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-email-alert")).toBeHidden();
  });
});
