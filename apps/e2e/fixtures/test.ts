import { test as base, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { signupOrganizationOwner, ensureTasksProductEntitlement } from "../utils/api-client";
import { hasSupabaseAdmin, resetUserEmailVerification } from "../utils/supabase-admin";

export interface OwnerSession {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  organizationId: string;
  userId: string;
  tenantId: string;
  accessToken: string;
}

type TestFixtures = {
  ownerSession: OwnerSession;
  authedPage: Page;
  tasksBaseUrl: string;
};

export const test = base.extend<TestFixtures>({
  ownerSession: [
    async ({}, use) => {
      const suffix = randomUUID().slice(0, 8);
      const email = `e2e.owner.${suffix}@example.com`;
      const password = `P@ssw0rd${suffix}`;
      const organizationName = `E2E Org ${suffix}`;
      const fullName = `Owner ${suffix}`;

      const session = await signupOrganizationOwner({
        email,
        password,
        fullName,
        organizationName
      });

      await ensureTasksProductEntitlement(session.accessToken, {
        organizationId: session.organizationId,
        tenantId: session.tenantId,
        userId: session.userId
      });

      if (hasSupabaseAdmin) {
        await resetUserEmailVerification(session.userId).catch((error) => {
          console.warn("Failed to reset email verification", error);
        });
      }

      await use({
        email,
        password,
        fullName,
        organizationName,
        organizationId: session.organizationId,
        userId: session.userId,
        tenantId: session.tenantId,
        accessToken: session.accessToken
      });
    },
    { scope: "worker" }
  ],
  authedPage: async ({ page, ownerSession }, use) => {
    if (hasSupabaseAdmin) {
      await resetUserEmailVerification(ownerSession.userId).catch((error) => {
        console.warn("Failed to reset email verification", error);
      });
    }

    await page.goto("/login");
    await page.getByLabel("Email address").fill(ownerSession.email);
    await page.getByLabel("Password").fill(ownerSession.password);
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await use(page);
  },
  tasksBaseUrl: [
    async ({}, use) => {
      await use(process.env.E2E_TASKS_BASE_URL ?? "http://localhost:3300");
    },
    { scope: "worker" }
  ]
});

export { expect };
