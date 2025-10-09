import { test, expect } from "../fixtures/test";

test.describe("Login flow", () => {
  test("allows a user to sign in and sign out", async ({ page, ownerSession }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(ownerSession.email);
    await page.getByTestId("login-password").fill(ownerSession.password);
    await page.getByTestId("login-submit").click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-heading")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await page.waitForURL("**/login");
    await expect(page.getByTestId("login-heading")).toBeVisible();
  });

  test("rejects an invalid password", async ({ page, ownerSession }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(ownerSession.email);
    await page.getByTestId("login-password").fill(`${ownerSession.password}!wrong`);
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-message")).toBeVisible();
    await expect(page.getByTestId("login-message")).toContainText("Invalid login credentials");
  });
});
