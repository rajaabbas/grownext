import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe("Profile management", () => {
  test("updates profile information", async ({ authedPage, ownerSession }) => {
    await authedPage.goto("/profile");
    await authedPage.waitForLoadState("networkidle");

    const updatedName = `Updated ${randomUUID().slice(0, 4)}`;

    await expect(authedPage.getByTestId("profile-email-input")).toHaveValue(ownerSession.email);
    await authedPage.getByTestId("profile-full-name-input").fill(updatedName);
    await authedPage.getByTestId("profile-submit").click();

    await expect(authedPage.getByTestId("profile-message")).toContainText("Profile updated");
  });

  test("signs out other sessions", async ({ authedPage }) => {
    await authedPage.goto("/profile");
    await authedPage.waitForLoadState("networkidle");

    await authedPage.getByTestId("session-signout-others").click();
    await expect(authedPage.getByTestId("session-message")).toContainText(
      "Signed out from other devices"
    );
  });
});
