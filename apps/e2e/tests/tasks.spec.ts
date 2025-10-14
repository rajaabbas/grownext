import { test, expect } from "../fixtures/test";
import { fetchTasksTenancyContext } from "../utils/api-client";

const normalizeBaseUrl = (url: string): string => {
  if (url.endsWith("/")) return url.slice(0, -1);
  return url;
};

test.describe("Tasks App", () => {
  test("allows the organization owner to create and update tasks", async ({ authedPage, tasksBaseUrl }) => {
    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);

    await authedPage.goto(tasksBaseUrl);
    await authedPage.waitForURL(/http.+/);

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible();

    const taskTitle = `E2E Task ${Date.now()}`;
    const taskDescription = "Verify task creation via e2e";

    await authedPage.getByPlaceholder("Add a task").fill(taskTitle);
    await authedPage.getByPlaceholder("Optional description").fill(taskDescription);
    await authedPage.getByRole("button", { name: "Add task" }).click();

    const taskItem = authedPage.locator("li", { hasText: taskTitle }).first();
    await expect(taskItem).toBeVisible();
    await expect(taskItem.getByText(taskDescription)).toBeVisible();

    const checkbox = taskItem.getByRole("checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    await authedPage.reload();
    await authedPage.waitForURL((url) => url.startsWith(normalizedTasksBase));
    await expect(authedPage.locator("li", { hasText: taskTitle })).toBeVisible();

    // Return to the portal so other tests continue to run in a known state.
    await authedPage.goto("/dashboard");
  });

  test("portal launcher opens the tasks application", async ({ authedPage, tasksBaseUrl }) => {
    await authedPage.goto("/");

    const tasksLink = authedPage.getByRole("link", { name: /Tasks/i }).first();
    await expect(tasksLink).toBeVisible();

    const href = await tasksLink.getAttribute("href");
    const normalizedTasksBase = normalizeBaseUrl(tasksBaseUrl);

    expect(href ?? "").toContain(normalizedTasksBase);

    await Promise.all([
      authedPage.waitForNavigation({ url: (url) => url.startsWith(normalizedTasksBase) }),
      tasksLink.click()
    ]);

    await expect(authedPage.getByRole("heading", { name: "Tasks" })).toBeVisible();

    await authedPage.goto("/dashboard");
  });

  test("identity exposes tasks tenancy context via API", async ({ ownerSession }) => {
    const context = await fetchTasksTenancyContext(ownerSession.accessToken);
    expect(context.user.id).toBe(ownerSession.userId);
    expect(context.organization.id).toBe(ownerSession.organizationId);
    expect(context.activeTenant.tenantId).toBe(ownerSession.tenantId);
    expect(context.entitlements.some((entitlement) => entitlement.tenantId === ownerSession.tenantId)).toBe(true);
  });
});
