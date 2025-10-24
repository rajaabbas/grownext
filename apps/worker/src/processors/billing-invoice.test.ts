"use strict";

import { describe, expect, it, vi } from "vitest";
import { IdentityHttpError } from "@ma/identity-client";
import { logger } from "@ma/core";
import { processBillingInvoiceJob, type BillingInvoiceProcessorDeps } from "./billing-invoice";

const buildDeps = (
  overrides: Partial<BillingInvoiceProcessorDeps> = {}
): BillingInvoiceProcessorDeps => ({
  createInvoice: vi.fn().mockResolvedValue({
    invoiceId: "inv-1",
    status: "OPEN",
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    lineCount: 0,
    durationMs: 0
  }),
  ...overrides
});

describe("processBillingInvoiceJob", () => {
  it("delegates invoice creation to dependency", async () => {
    const createInvoice = vi.fn().mockResolvedValue({
      invoiceId: "inv-1",
      status: "PAID",
      subtotalCents: 12000,
      taxCents: 960,
      totalCents: 12960,
      lineCount: 4,
      durationMs: 75
    });

    const deps = buildDeps({ createInvoice });

    const payload = {
      organizationId: "org-1",
      subscriptionId: "sub-1",
      periodStart: "2024-10-01T00:00:00Z",
      periodEnd: "2024-10-31T23:59:59Z",
      usageCharges: [],
      extraLines: [],
      status: "OPEN"
    };

    const result = await processBillingInvoiceJob(payload, deps);

    expect(createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        periodStart: "2024-10-01T00:00:00Z",
        periodEnd: "2024-10-31T23:59:59Z"
      })
    );
    expect(result).toEqual({
      invoiceId: "inv-1",
      status: "PAID",
      subtotalCents: 12000,
      taxCents: 960,
      totalCents: 12960,
      lineCount: 4,
      durationMs: 75
    });
  });

  it("throws when period end is not after period start", async () => {
    await expect(
      processBillingInvoiceJob(
        {
          organizationId: "org-1",
          periodStart: "2024-10-01T00:00:00Z",
          periodEnd: "2024-10-01T00:00:00Z"
        },
        buildDeps()
      )
    ).rejects.toThrow("periodEnd must be later than periodStart");
  });

  it("logs and rethrows identity rate limit errors", async () => {
    const identityError = new IdentityHttpError("rate limited", {
      status: 429,
      retryAfter: 25
    });
    const createInvoice = vi.fn().mockRejectedValue(identityError);
    const deps = buildDeps({ createInvoice });
    const errorSpy = vi.spyOn(logger, "error");

    await expect(
      processBillingInvoiceJob(
        {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          periodStart: "2024-10-01T00:00:00Z",
          periodEnd: "2024-10-31T23:59:59Z",
          usageCharges: [],
          extraLines: [],
          status: "OPEN"
        },
        deps
      )
    ).rejects.toBe(identityError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        retryAfterSeconds: 25,
        error: "rate limited"
      }),
      "Billing invoice creation throttled"
    );

    errorSpy.mockRestore();
  });
});
