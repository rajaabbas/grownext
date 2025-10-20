import { test, expect } from "../../fixtures/test";
import {
  fetchOrganizationDetail,
  fetchOrganizationProducts,
  fetchTasksTenancyContext,
  enableTenantApp,
  refreshAccessToken
} from "../../utils/api-client";

const normalizeBaseUrl = (url: string): string => {
  if (url.endsWith("/")) return url.slice(0, -1);
  return url;
};

const portalBaseUrl =
  process.env.E2E_BASE_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3200";
const tasksProductSlug = "tasks";

test.describe("Tasks App", () => {
  test("allows the organization owner to create and update tasks", async ({
    authedPage,
    tasksBaseUrl,
    ownerSession
  }, testInfo) => {
    testInfo.setTimeout(90_000);
    const accessToken = await refreshAccessToken(ownerSession.email, ownerSession.password);
    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);
    const tasksUrl = `${normalizedTasksBase}?tenantId=${ownerSession.tenantId}`;

    const { products: orgProducts } = await fetchOrganizationProducts(
      accessToken,
      ownerSession.organizationId
    );
    const tasksProduct = orgProducts.find((product) => product.slug === tasksProductSlug);
    expect(tasksProduct).toBeTruthy();
    await enableTenantApp(accessToken, ownerSession.tenantId, tasksProduct!.id);

    await authedPage.goto(tasksUrl);
    await authedPage.waitForURL(/tenantId=/);

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 15_000 });

    const loadingNotice = authedPage.getByText("Loading tasks…");
    await loadingNotice.first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);

    const refreshNotice = authedPage.getByText("Refreshing tasks…");
    const waitForRefreshComplete = async () => {
      const banner = refreshNotice.first();
      await banner.waitFor({ state: "attached", timeout: 5_000 }).catch(() => undefined);
      await banner.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
    };

    const taskTitle = `E2E Task ${Date.now()}`;
    await authedPage.getByPlaceholder("Click Here To Add A Task").fill(taskTitle);
    await authedPage.getByRole("button", { name: "Add task" }).click();

    await waitForRefreshComplete();

    const taskCard = authedPage
      .locator("div")
      .filter({ has: authedPage.getByRole("button", { name: taskTitle }) })
      .first();

    await expect(taskCard).toBeVisible();

    // Update priority
    await taskCard.getByRole("button", { name: "Change priority" }).click();
    await taskCard.getByRole("button", { name: "High" }).click();
    await waitForRefreshComplete();
    await expect(taskCard.locator("text=High").first()).toBeVisible({ timeout: 10_000 });

    // Change visibility
    await taskCard.getByRole("button", { name: "Change visibility" }).click();
    await taskCard.getByRole("button", { name: "Only me" }).click();
    await waitForRefreshComplete();
    await expect(taskCard.locator("text=Only me").first()).toBeVisible({ timeout: 10_000 });

    // Progress task status to COMPLETED
    const advanceButton = taskCard.getByRole("button", { name: /^Move to / });
    await expect(advanceButton).toHaveAccessibleName("Move to In Progress");
    await advanceButton.click();
    await waitForRefreshComplete();
    await expect(advanceButton).toHaveAccessibleName("Move to Completed", { timeout: 20_000 });

    await advanceButton.click();
    await waitForRefreshComplete();
    await expect(advanceButton).toHaveAccessibleName("Move to Archived", { timeout: 20_000 });

    await authedPage.reload({ waitUntil: "networkidle" });
    await authedPage.waitForURL((url) => {
      const hrefValue = typeof url === "string" ? url : url.href;
      return hrefValue.startsWith(normalizedTasksBase);
    });

    const persistedTaskCard = authedPage
      .locator("div")
      .filter({ has: authedPage.getByRole("button", { name: taskTitle }) })
      .first();

    await expect(
      persistedTaskCard.getByRole("button", { name: "Move to Archived" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(persistedTaskCard.locator("text=High").first()).toBeVisible({ timeout: 10_000 });
    await expect(persistedTaskCard.locator("text=Only me").first()).toBeVisible({ timeout: 10_000 });

    // Return to the portal so other tests continue to run in a known state.
    await authedPage.goto(`${portalBaseUrl}/`);
  });

  test("portal launcher opens the tasks application", async ({
    authedPage,
    tasksBaseUrl,
    ownerSession
  }) => {
    const accessToken = await refreshAccessToken(ownerSession.email, ownerSession.password);
    await authedPage.goto(`${portalBaseUrl}/`);

    const orgDetail = await fetchOrganizationDetail(accessToken, ownerSession.organizationId);
    const defaultTenant = orgDetail.tenants.find(
      (tenant) => tenant.id === ownerSession.tenantId
    ) ?? orgDetail.tenants[0];
    const tenantIdentifier = defaultTenant?.slug ?? defaultTenant?.id ?? ownerSession.tenantId;

    const { products } = await fetchOrganizationProducts(accessToken, ownerSession.organizationId);
    const tasksProduct = products.find((product) => product.slug === tasksProductSlug);
    expect(tasksProduct).toBeTruthy();

    await enableTenantApp(accessToken, ownerSession.tenantId, tasksProduct!.id).catch(() => undefined);

    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);

    await authedPage.goto(
      `${portalBaseUrl}/tenants/${tenantIdentifier}/apps/${tasksProduct!.id}/open`
    );
    await authedPage.waitForURL((url) => {
      const hrefValue = typeof url === "string" ? url : url.href;
      return hrefValue.startsWith(normalizedTasksBase);
    });

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 15_000 });

    await authedPage.goto(`${portalBaseUrl}/`);
  });

  test("identity exposes tasks tenancy context via API", async ({ ownerSession }) => {
    const accessToken = await refreshAccessToken(ownerSession.email, ownerSession.password);
    const context = await fetchTasksTenancyContext(accessToken);
    expect(context.user.id).toBe(ownerSession.userId);
    expect(context.organization.id).toBe(ownerSession.organizationId);
    expect(context.activeTenant.tenantId).toBe(ownerSession.tenantId);
    expect(context.entitlements.some((entitlement) => entitlement.tenantId === ownerSession.tenantId)).toBe(true);
  });
});
