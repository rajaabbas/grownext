import { randomUUID } from "crypto";
import { test, expect } from "../../fixtures/test";

test.describe("Profile management", () => {
  test("user can update profile and organization details", async ({ authedPage }) => {
    await authedPage.goto("/profile");
    await authedPage.waitForLoadState("networkidle");

    const nameSuffix = randomUUID().slice(0, 8);
    const newFullName = `Owner ${nameSuffix}`;
    const newEmail = `owner+${nameSuffix}@example.com`;

    const fullNameField = authedPage.getByLabel("Full name");
    await fullNameField.fill(newFullName);

    await authedPage.getByRole("button", { name: /Save changes/i }).click();
    await expect(authedPage.getByText(/Profile updated successfully/i)).toBeVisible();

    const emailField = authedPage.getByLabel("Email address");
    await emailField.fill(newEmail);
    await authedPage.getByRole("button", { name: /Save changes/i }).click();
    await expect(authedPage.getByText(/Profile updated successfully/i)).toBeVisible();
  });
});
