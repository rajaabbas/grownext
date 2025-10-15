import { randomUUID } from "crypto";
import { test, expect } from "../fixtures/test";
import { createOrganizationInvitation } from "../utils/api-client";

test.describe("Organization invitations", () => {
  test("invitation landing page displays invite details", async ({ page, ownerSession }) => {
    const inviteeEmail = `invitee.${randomUUID().slice(0, 8)}@example.com`;

    const invitation = await createOrganizationInvitation(ownerSession.accessToken, {
      email: inviteeEmail,
      role: "MEMBER"
    });

    expect(invitation.token).toBeTruthy();

    await page.goto(`/auth/invite?token=${invitation.token}`);
    await expect(page.getByRole("heading", { name: /Accept invitation/i })).toBeVisible();
    await expect(page.getByText(inviteeEmail)).toBeVisible();
    await expect(page.getByText(ownerSession.organizationName)).toBeVisible();
  });
});
