import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";

test.describe.configure({ mode: "serial" });

test.describe("Invitation flows", () => {
  test("invites, accepts, and manages a member", async ({ authedPage, browser, ownerSession }) => {
    await authedPage.goto("/organization");
    await authedPage.waitForLoadState("networkidle");

    const inviteEmail = `member.${randomUUID().slice(0, 6)}@example.com`;
    const inviteName = `Invitee ${randomUUID().slice(0, 4)}`;
    const invitePassword = `P@ssword${randomUUID().slice(0, 6)}!`;

    await authedPage.getByTestId("invite-email").fill(inviteEmail);
    await authedPage.getByTestId("invite-submit").click();
    await expect(authedPage.getByTestId("invite-latest-link")).toBeVisible();

    const linkContainer = authedPage.getByTestId("invite-latest-link").locator("p").last();
    const invitationUrl = (await linkContainer.textContent())?.trim();
    expect(invitationUrl).toBeTruthy();

    const inviteContext = await browser.newContext();
    const invitePage = await inviteContext.newPage();
    await invitePage.goto(invitationUrl!);

    await expect(invitePage.getByTestId("accept-invitation-heading")).toBeVisible();
    await expect(invitePage.getByTestId("accept-invitation-email")).toContainText(inviteEmail);

    await invitePage.getByTestId("accept-invitation-full-name").fill(inviteName);
    await invitePage.getByTestId("accept-invitation-password").fill(invitePassword);
    await invitePage.getByTestId("accept-invitation-confirm-password").fill(invitePassword);
    await invitePage.getByTestId("accept-invitation-submit").click();

    await invitePage.waitForURL("**/dashboard");
    await expect(invitePage.getByTestId("dashboard-heading")).toBeVisible();

    await inviteContext.close();

    await authedPage.reload({ waitUntil: "domcontentloaded" });

    const memberRow = authedPage.locator("tr", { hasText: inviteEmail });
    await expect(memberRow).toBeVisible();

    const roleSelect = memberRow.getByRole("combobox");
    await roleSelect.selectOption("ADMIN");
    await expect(roleSelect).toHaveValue("ADMIN");

    await memberRow.getByRole("button", { name: "Remove" }).click();
    await authedPage.reload({ waitUntil: "domcontentloaded" });
    await expect(authedPage.locator("tr", { hasText: inviteEmail })).toHaveCount(0, {
      timeout: 15_000
    });

    const ownerRow = authedPage.locator("tr", { hasText: ownerSession.email });
    await expect(ownerRow.getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});
