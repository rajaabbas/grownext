import { test, expect } from "../../fixtures/test";

test.describe("Portal billing flows", () => {
  test("shows billing overview with plan summary and invoices", async ({ authedPage }) => {
    await authedPage.goto("/billing");
    await expect(authedPage.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Plan summary" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Usage at a glance" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Recent invoices" })).toBeVisible();
  });

  test("renders usage filters and series table", async ({ authedPage }) => {
    await authedPage.goto("/billing/usage");
    await expect(authedPage.getByRole("heading", { name: "Usage" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Filters" })).toBeVisible();
    await expect(authedPage.getByRole("heading", { name: "Summaries" })).toBeVisible();
  });

  test("submits a plan change request", async ({ authedPage }) => {
    await authedPage.goto("/billing");

    await authedPage.getByLabel(/Target package ID/i).fill("scale");
    await authedPage.getByLabel("Timing").selectOption("immediate");
    await authedPage.getByLabel(/Reason \(optional\)/i).fill("E2E upgrade coverage");

    await authedPage.getByRole("button", { name: "Request plan change" }).click();

    await expect(
      authedPage.getByText("Subscription change requested successfully.")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("updates the default payment method", async ({ authedPage }) => {
    await authedPage.goto("/billing");

    const providerId = `pm_e2e_${Date.now()}`;
    const response = await authedPage.request.post("/api/billing/payment-methods", {
      headers: { "x-requested-with": "XMLHttpRequest" },
      data: {
        providerId,
        type: "CARD",
        brand: "Mastercard",
        last4: "5555",
        expMonth: 11,
        expYear: new Date().getFullYear() + 2,
        setDefault: true
      }
    });

    expect(response.ok()).toBeTruthy();

    await authedPage.reload();
    await expect(authedPage.getByText(/MASTERCARD ending in 5555/i)).toBeVisible({
      timeout: 10_000
    });
  });
});
