import { test, expect } from "../../fixtures/test";

test.describe("Logout flow", () => {
  test("signs the user out from the tasks shell menu", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("networkidle");

    await authedPage.getByRole("button", { name: "User menu" }).click();
    await authedPage.getByRole("button", { name: "Logout" }).click();

    await authedPage.waitForURL("**/login");
    await expect(authedPage.getByRole("heading", { name: /Sign in to GrowNext/i })).toBeVisible();
    await expect(authedPage.getByLabel("Email address")).toBeVisible();
  });
});
