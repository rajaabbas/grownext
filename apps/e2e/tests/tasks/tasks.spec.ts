import { test, expect } from "../../fixtures/test";
import {
  fetchOrganizationDetail,
  fetchOrganizationProducts,
  fetchTasksTenancyContext,
  enableTenantApp
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
  }) => {
    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);
    const tasksUrl = `${normalizedTasksBase}?tenantId=${ownerSession.tenantId}`;

    const { products: orgProducts } = await fetchOrganizationProducts(
      ownerSession.accessToken,
      ownerSession.organizationId
    );
    const tasksProduct = orgProducts.find((product) => product.slug === tasksProductSlug);
    expect(tasksProduct).toBeTruthy();
    await enableTenantApp(ownerSession.accessToken, ownerSession.tenantId, tasksProduct!.id);

    await authedPage.goto(tasksUrl);
    await authedPage.waitForURL(/tenantId=/);

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 15_000 });

    const taskTitle = `E2E Task ${Date.now()}`;
    const taskDescription = "Verify task creation via e2e";

    await authedPage.getByPlaceholder("Add a task").fill(taskTitle);
    await authedPage.getByPlaceholder("Optional description").fill(taskDescription);
    await authedPage.getByRole("button", { name: "Add task" }).click();

    const taskItem = authedPage.locator("li", { hasText: taskTitle }).first();
    await expect(taskItem).toBeVisible();
    await expect(taskItem.getByText(taskDescription)).toBeVisible();

    await taskItem.getByRole("checkbox").click();
    await expect(taskItem.getByText("Status: COMPLETED")).toBeVisible({ timeout: 15000 });

    await taskItem.getByRole("checkbox").click();
    await expect(taskItem.getByText("Status: OPEN")).toBeVisible({ timeout: 15000 });

    await authedPage.reload({ waitUntil: "networkidle" });
    await authedPage.waitForURL((url) => {
      const hrefValue = typeof url === "string" ? url : url.href;
      return hrefValue.startsWith(normalizedTasksBase);
    });
    await expect(authedPage.locator("li", { hasText: taskTitle })).toBeVisible();

    // Return to the portal so other tests continue to run in a known state.
    await authedPage.goto(`${portalBaseUrl}/dashboard`);
  });

  test("portal launcher opens the tasks application", async ({
    authedPage,
    tasksBaseUrl,
    ownerSession
  }) => {
    await authedPage.goto(`${portalBaseUrl}/`);

    const orgDetail = await fetchOrganizationDetail(ownerSession.accessToken, ownerSession.organizationId);
    const defaultTenant = orgDetail.tenants.find(
      (tenant) => tenant.id === ownerSession.tenantId
    ) ?? orgDetail.tenants[0];
    const tenantIdentifier = defaultTenant?.slug ?? defaultTenant?.id ?? ownerSession.tenantId;

    const { products } = await fetchOrganizationProducts(ownerSession.accessToken, ownerSession.organizationId);
    const tasksProduct = products.find((product) => product.slug === tasksProductSlug);
    expect(tasksProduct).toBeTruthy();

    await enableTenantApp(ownerSession.accessToken, ownerSession.tenantId, tasksProduct!.id).catch(() => undefined);

    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);

    await authedPage.goto(
      `${portalBaseUrl}/tenants/${tenantIdentifier}/apps/${tasksProduct!.id}/open`
    );
    await authedPage.waitForURL((url) => {
      const hrefValue = typeof url === "string" ? url : url.href;
      return hrefValue.startsWith(normalizedTasksBase);
    });

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 15_000 });

    await authedPage.goto(`${portalBaseUrl}/dashboard`);
  });

  test("identity exposes tasks tenancy context via API", async ({ ownerSession }) => {
    const context = await fetchTasksTenancyContext(ownerSession.accessToken);
    expect(context.user.id).toBe(ownerSession.userId);
    expect(context.organization.id).toBe(ownerSession.organizationId);
    expect(context.activeTenant.tenantId).toBe(ownerSession.tenantId);
    expect(context.entitlements.some((entitlement) => entitlement.tenantId === ownerSession.tenantId)).toBe(true);
  });
});
