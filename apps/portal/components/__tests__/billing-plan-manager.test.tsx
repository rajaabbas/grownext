import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPlanManager } from "../billing-plan-manager";

describe("BillingPlanManager", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("surfaces rate limit guidance when plan changes are throttled", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === "retry-after" ? "45" : null)
      } as Headers,
      json: async () => ({ error: "rate_limited" })
    }));

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BillingPlanManager subscription={null} activePackage={null} />);

    fireEvent.change(screen.getByLabelText(/Target package ID/i), {
      target: { value: "pkg_pro_plus" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Request plan change" }));

    await waitFor(() => {
      expect(
        screen.getByText(/We received too many plan change requests\. Try again in about 45 seconds\./i)
      ).toBeInTheDocument();
    });
  });
});
