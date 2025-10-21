"use strict";

import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@ma/db";
import type { SupabaseJwtClaims } from "@ma/core";
import type { BillingInvoice } from "@ma/db";
import {
  processBillingPaymentSyncJob,
  type BillingPaymentSyncProcessorDeps
} from "./billing-payment-sync";

const baseClaims: SupabaseJwtClaims = {
  sub: "service-role",
  role: "authenticated",
  organization_id: "org-1"
};

const buildInvoice = (overrides: Partial<BillingInvoice> = {}): BillingInvoice => ({
  id: "inv-1",
  organizationId: "org-1",
  subscriptionId: "sub-1",
  number: "INV-001",
  status: "OPEN",
  currency: "usd",
  subtotalCents: 10000,
  taxCents: 0,
  totalCents: 10000,
  balanceCents: 10000,
  dueAt: new Date("2024-04-30T00:00:00Z"),
  issuedAt: new Date("2024-04-01T00:00:00Z"),
  paidAt: null,
  voidedAt: null,
  externalId: null,
  metadata: Prisma.JsonNull,
  createdAt: new Date("2024-04-01T00:00:00Z"),
  updatedAt: new Date("2024-04-01T00:00:00Z"),
  ...overrides
});

const buildDeps = (
  overrides: Partial<BillingPaymentSyncProcessorDeps> = {}
): BillingPaymentSyncProcessorDeps => {
  const defaults: BillingPaymentSyncProcessorDeps = {
    getInvoice: vi.fn(),
    recordPayment: vi.fn(),
    updateInvoiceStatus: vi.fn(),
    createCreditMemo: vi.fn(),
    buildClaims: vi.fn().mockReturnValue(baseClaims)
  };

  return { ...defaults, ...overrides };
};

describe("processBillingPaymentSyncJob", () => {
  it("records successful payments", async () => {
    const invoice = buildInvoice();
    const recordPayment = vi
      .fn()
      .mockResolvedValue(buildInvoice({ status: "PAID", balanceCents: 0 }));

    const deps = buildDeps({
      getInvoice: vi.fn().mockResolvedValue(invoice),
      recordPayment
    });

    const result = await processBillingPaymentSyncJob(
      {
        organizationId: "org-1",
        invoiceId: "inv-1",
        event: "payment_succeeded"
      },
      deps
    );

    expect(recordPayment).toHaveBeenCalledWith(baseClaims, "inv-1", 10000, expect.any(Date));
    expect(result).toEqual(
      expect.objectContaining({
        invoiceId: "inv-1",
        status: "PAID",
        action: "PAYMENT_RECORDED"
      })
    );
  });

  it("creates credit memo on disputes and updates status", async () => {
    const invoice = buildInvoice();

    const createCreditMemo = vi.fn().mockResolvedValue({ id: "credit-1" });
    const updateInvoiceStatus = vi
      .fn()
      .mockResolvedValue(buildInvoice({ status: "UNCOLLECTIBLE" }));

    const deps = buildDeps({
      getInvoice: vi.fn().mockResolvedValue(invoice),
      createCreditMemo,
      updateInvoiceStatus
    });

    const result = await processBillingPaymentSyncJob(
      {
        organizationId: "org-1",
        invoiceId: "inv-1",
        event: "payment_disputed",
        amountCents: 4200
      },
      deps
    );

    expect(createCreditMemo).toHaveBeenCalledWith(baseClaims, {
      organizationId: "org-1",
      invoiceId: "inv-1",
      amountCents: 4200,
      currency: "usd",
      reason: "SERVICE_FAILURE",
      metadata: undefined
    });

    expect(updateInvoiceStatus).toHaveBeenCalledWith(baseClaims, "inv-1", "UNCOLLECTIBLE", {
      metadata: undefined
    });

    expect(result).toEqual(
      expect.objectContaining({
        invoiceId: "inv-1",
        status: "UNCOLLECTIBLE",
        action: "CREDIT_ISSUED"
      })
    );
  });
});
