import { randomUUID } from "crypto";
import { test, expect } from "../../fixtures/test";
import { signupOrganizationOwner, ensureTasksProductEntitlement } from "../../utils/api-client";

const createRecoveryTestAccount = async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `e2e.recovery.${suffix}@example.com`;
  const password = `P@ssw0rd${suffix}!`;
  const organizationName = `Recovery Org ${suffix}`;

  const session = await signupOrganizationOwner({
    email,
    password,
    fullName: `Recovery Owner ${suffix}`,
    organizationName
  });

  await ensureTasksProductEntitlement(session.accessToken, {
    organizationId: session.organizationId,
    tenantId: session.tenantId,
    userId: session.userId
  });

  return { email, password, organizationName };
};

test.describe("Organization recovery flow", () => {
  test("requires recovery after deletion and allows creating a replacement organization", async ({ page }) => {
    const account = await createRecoveryTestAccount();

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Launchpad/i })).toBeVisible();

    await page.goto("/organization/settings", { waitUntil: "networkidle" });
    const deleteButton = page.getByRole("button", { name: "Delete organization" });
    await expect(deleteButton).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await deleteButton.click();

    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Sign in to GrowNext" })).toBeVisible();

    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: /Continue/i }).click();

    await page.waitForURL("/auth/recover-workspace", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Create a new organization" })).toBeVisible();

    const replacementOrgName = `Recovered Org ${randomUUID().slice(0, 6)}`;
    await page.getByLabel("Organization name").fill(replacementOrgName);
    await page.getByRole("button", { name: "Create organization" }).click();

    await page.waitForURL("/login?reason=organization-activated", { timeout: 20_000 });
    await expect(
      page.getByText("Your organization is ready. Sign in again to continue.")
    ).toBeVisible();

    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: /Continue/i }).click();

    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Launchpad/i })).toBeVisible();
  });
});
