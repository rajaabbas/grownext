import { test as base, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { signupOrganizationOwner } from "../utils/api-client";
import { hasSupabaseAdmin, resetUserEmailVerification } from "../utils/supabase-admin";

export interface OwnerSession {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  organizationId: string;
  userId: string;
  accessToken: string;
}

type TestFixtures = {
  ownerSession: OwnerSession;
  authedPage: Page;
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
    await page.getByTestId("login-email").fill(ownerSession.email);
    await page.getByTestId("login-password").fill(ownerSession.password);
    await page.getByTestId("login-submit").click();
    await page.waitForURL("**/dashboard");
    await page.waitForLoadState("networkidle");

    await use(page);
  }
});

export { expect };
