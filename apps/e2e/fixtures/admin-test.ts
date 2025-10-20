import { test as base, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { createSupabaseUser, hasSupabaseAdmin } from "../utils/supabase-admin";

type SuperAdminSession = {
  email: string;
  password: string;
  fullName: string;
  userId: string;
};

type AdminFixtures = {
  superAdmin: SuperAdminSession;
  adminBaseUrl: string;
  adminPage: Page;
};

export const adminTest = base.extend<AdminFixtures>({
  superAdmin: [
    async ({}, use) => {
      if (!hasSupabaseAdmin) {
        throw new Error("Supabase admin credentials are required for admin E2E tests (E2E_SUPABASE_URL/E2E_SUPABASE_SERVICE_ROLE_KEY).");
      }

      const suffix = randomUUID().slice(0, 8);
      const email = `e2e.superadmin.${suffix}@example.com`;
      const password = `Sup3r@${suffix}`;
      const fullName = `E2E Super Admin ${suffix}`;

      const user = await createSupabaseUser({
        email,
        password,
        userMetadata: {
          full_name: fullName,
          roles: ["super-admin"],
          "super-admin": true,
          super_admin: true
        },
        appMetadata: {
          roles: ["super-admin"],
          "super-admin": true,
          super_admin: true
        }
      });

      await use({ email, password, fullName, userId: user.id });
    },
    { scope: "worker" }
  ],
  adminBaseUrl: [
    async ({}, use) => {
      const baseUrl =
        process.env.E2E_ADMIN_BASE_URL ??
        process.env.ADMIN_APP_URL ??
        "http://localhost:3500";
      await use(baseUrl.replace(/\/$/, ""));
    },
    { scope: "worker" }
  ],
  adminPage: async ({ page, superAdmin, adminBaseUrl }, use) => {
    await page.goto(`${adminBaseUrl}/signin`);
    await page.getByLabel("Email").fill(superAdmin.email);
    await page.getByLabel("Password").fill(superAdmin.password);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Super Admin console/i })).toBeVisible({
      timeout: 15_000
    });

    await use(page);
  }
});

export { expect } from "@playwright/test";
