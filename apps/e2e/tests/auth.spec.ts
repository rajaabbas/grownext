import { test, expect } from "../fixtures/test";

test.describe("Login flow", () => {
  test("allows a user to sign in and sign out", async ({ page, ownerSession }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerSession.email);
    await page.getByLabel("Password").fill(ownerSession.password);
    await page.getByRole("button", { name: /Continue/i }).click();

    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByText(ownerSession.email)).toBeVisible();
    await expect(page.getByRole("link", { name: /Manage tenants/i })).toBeVisible();
  });

  test("rejects an invalid password", async ({ page, ownerSession }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerSession.email);
    await page.getByLabel("Password").fill(`${ownerSession.password}!wrong`);
    await page.getByRole("button", { name: /Continue/i }).click();

    await expect(page.getByText("Invalid login credentials")).toBeVisible();
  });
});
