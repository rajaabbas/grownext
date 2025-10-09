import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe.configure({ mode: "serial" });

test.describe("Organization management", () => {
  test("updates organization details", async ({ authedPage }) => {
    await authedPage.goto("/organization");
    await authedPage.waitForLoadState("networkidle");

    const newName = `Updated Org ${randomUUID().slice(0, 4)}`;
    const newSlug = `updated-org-${randomUUID().slice(0, 4)}`;

    await authedPage.getByTestId("organization-name-input").fill(newName);
    await authedPage.getByTestId("organization-slug-input").fill(newSlug);
    await authedPage.getByTestId("organization-settings-submit").click();

    await expect(authedPage.getByTestId("organization-settings-message")).toContainText(
      "Organization details updated"
    );
  });

  test("invites and revokes a member", async ({ authedPage }) => {
    await authedPage.goto("/organization");
    await authedPage.waitForLoadState("networkidle");

    const inviteEmail = `invitee.${randomUUID().slice(0, 6)}@example.com`;

    await authedPage.getByTestId("invite-email").fill(inviteEmail);
    await authedPage.getByTestId("invite-submit").click();
    await expect(authedPage.getByTestId("invite-latest-link")).toBeVisible();

    const listItem = authedPage.locator("li", { hasText: inviteEmail });
    await expect(listItem).toBeVisible();

    await listItem.getByRole("button", { name: "Revoke" }).click();
    await expect(listItem).toHaveCount(0);
  });
});
