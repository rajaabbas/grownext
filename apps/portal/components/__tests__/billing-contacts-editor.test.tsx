import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingContact } from "@ma/contracts";
import { BillingContactsEditor } from "../billing-contacts-editor";

describe("BillingContactsEditor", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("displays rate limit messaging when updates are throttled", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === "retry-after" ? "30" : null)
      } as Headers,
      json: async () => ({ error: "rate_limited" })
    }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const contacts: BillingContact[] = [
      {
        id: "contact-1",
        name: "Jane Doe",
        email: "jane@example.com",
        role: "finance",
        phone: null,
        metadata: null
      }
    ];

    render(<BillingContactsEditor contacts={contacts} taxIds={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Save contacts" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /We received too many billing contact update requests\. Try again in about 30 seconds\./i
        )
      ).toBeInTheDocument();
    });
  });
});
