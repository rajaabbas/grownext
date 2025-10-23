"use strict";

import { describe, expect, it, vi } from "vitest";
import {
  processBillingPaymentSyncJob,
  type BillingPaymentSyncProcessorDeps
} from "./billing-payment-sync";

const buildDeps = (
  overrides: Partial<BillingPaymentSyncProcessorDeps> = {}
): BillingPaymentSyncProcessorDeps => ({
  syncPayment: vi.fn().mockResolvedValue({
    invoiceId: "inv-1",
    status: "OPEN",
    action: "STATUS_UPDATED",
    durationMs: 0
  }),
  ...overrides
});

describe("processBillingPaymentSyncJob", () => {
  it("delegates payment sync to dependency", async () => {
    const syncPayment = vi.fn().mockResolvedValue({
      invoiceId: "inv-1",
      status: "PAID",
      action: "PAYMENT_RECORDED",
      durationMs: 33
    });

    const deps = buildDeps({ syncPayment });

    const payload = {
      organizationId: "org-1",
      invoiceId: "inv-1",
      event: "payment_succeeded" as const,
      amountCents: 5000
    };

    const result = await processBillingPaymentSyncJob(payload, deps);

    expect(syncPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        invoiceId: "inv-1",
        event: "payment_succeeded",
        amountCents: 5000
      })
    );
    expect(result).toEqual({
      invoiceId: "inv-1",
      status: "PAID",
      action: "PAYMENT_RECORDED",
      durationMs: 33
    });
  });
});
