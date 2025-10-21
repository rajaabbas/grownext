"use strict";

import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@ma/db";
import type { SupabaseJwtClaims } from "@ma/core";
import type { BillingInvoice, BillingSubscription } from "@ma/db";
import {
  processBillingInvoiceJob,
  type BillingInvoiceProcessorDeps
} from "./billing-invoice";

const baseClaims: SupabaseJwtClaims = {
  sub: "service-role",
  role: "authenticated",
  organization_id: "org-1"
};

const buildSubscription = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  id: "sub-1",
  organizationId: "org-1",
  packageId: "pkg-1",
  status: "ACTIVE",
  currency: "usd",
  amountCents: 10000,
  billingInterval: "MONTHLY",
  currentPeriodStart: new Date("2024-04-01T00:00:00Z"),
  currentPeriodEnd: new Date("2024-05-01T00:00:00Z"),
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  externalId: null,
  metadata: Prisma.JsonNull,
  usageEvents: [],
  usageAggregates: [],
  invoices: [],
  schedules: [],
  createdAt: new Date("2024-03-01T00:00:00Z"),
  updatedAt: new Date("2024-03-01T00:00:00Z"),
  ...overrides
});

const buildInvoice = (overrides: Partial<BillingInvoice> = {}): BillingInvoice => ({
  id: "inv-1",
  organizationId: "org-1",
  subscriptionId: "sub-1",
  number: "INV-20240430-ABC123",
  status: "OPEN",
  currency: "usd",
  subtotalCents: 0,
  taxCents: 0,
  totalCents: 0,
  balanceCents: 0,
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
  overrides: Partial<BillingInvoiceProcessorDeps> = {}
): BillingInvoiceProcessorDeps => {
  const defaults: BillingInvoiceProcessorDeps = {
    getSubscription: vi.fn(),
    getActiveSubscription: vi.fn(),
    createInvoice: vi.fn(),
    addInvoiceLine: vi.fn(),
    fetchUsageTotals: vi.fn(),
    recordPayment: vi.fn(),
    buildClaims: vi.fn().mockReturnValue(baseClaims)
  };

  return { ...defaults, ...overrides };
};

describe("processBillingInvoiceJob", () => {
  it("creates invoice with recurring, usage, tax, and settlement", async () => {
    const subscription = buildSubscription();

    const createInvoice = vi
      .fn()
      .mockResolvedValue(
        buildInvoice({
          subtotalCents: 13000,
          taxCents: 975,
          totalCents: 13975,
          balanceCents: 13975
        })
      );

    const recordPayment = vi
      .fn()
      .mockResolvedValue(
        buildInvoice({
          subtotalCents: 13000,
          taxCents: 975,
          totalCents: 13975,
          balanceCents: 0,
          status: "PAID",
          paidAt: new Date("2024-04-05T12:00:00Z")
        })
      );

    const addInvoiceLine = vi.fn().mockResolvedValue(undefined);
    const deps = buildDeps({
      getActiveSubscription: vi.fn().mockResolvedValue(subscription),
      createInvoice,
      addInvoiceLine,
      fetchUsageTotals: vi.fn().mockResolvedValue(
        new Map([
          [
            "ai.tokens::DAILY",
            {
              quantity: new Prisma.Decimal(1500),
              unit: "tokens"
            }
          ]
        ])
      ),
      recordPayment
    });

    const result = await processBillingInvoiceJob(
      {
        organizationId: "org-1",
        periodStart: "2024-04-01T00:00:00Z",
        periodEnd: "2024-04-30T23:59:59Z",
        usageCharges: [
          {
            featureKey: "ai.tokens",
            unitAmountCents: 2,
            unit: "tokens",
            description: "AI token usage"
          }
        ],
        taxRateBps: 750,
        settle: {
          paidAt: "2024-04-05T12:00:00Z"
        }
      },
      deps
    );

    expect(deps.getActiveSubscription).toHaveBeenCalledWith(baseClaims, "org-1");

    expect(createInvoice).toHaveBeenCalledWith(baseClaims, {
      organizationId: "org-1",
      subscriptionId: "sub-1",
      number: expect.stringMatching(/^INV-/),
      status: "OPEN",
      currency: "usd",
      subtotalCents: 13000,
      taxCents: 975,
      totalCents: 13975,
      balanceCents: 13975,
      issuedAt: expect.any(Date),
      dueAt: expect.any(Date),
      metadata: undefined
    });

    expect(addInvoiceLine).toHaveBeenCalledTimes(3);
    expect(addInvoiceLine).toHaveBeenNthCalledWith(1, baseClaims, {
      invoiceId: "inv-1",
      lineType: "RECURRING",
      description: "monthly subscription",
      featureKey: "subscription",
      quantity: 1,
      unitAmountCents: 10000,
      amountCents: 10000,
      usagePeriodStart: undefined,
      usagePeriodEnd: undefined,
      metadata: undefined
    });
    expect(addInvoiceLine).toHaveBeenNthCalledWith(2, baseClaims, {
      invoiceId: "inv-1",
      lineType: "USAGE",
      description: "AI token usage",
      featureKey: "ai.tokens",
      quantity: new Prisma.Decimal(1500),
      unitAmountCents: 2,
      amountCents: 3000,
      usagePeriodStart: new Date("2024-04-01T00:00:00Z"),
      usagePeriodEnd: new Date("2024-04-30T23:59:59Z"),
      metadata: undefined
    });
    expect(addInvoiceLine).toHaveBeenNthCalledWith(3, baseClaims, {
      invoiceId: "inv-1",
      lineType: "TAX",
      description: "Tax",
      featureKey: undefined,
      quantity: 1,
      unitAmountCents: 975,
      amountCents: 975,
      usagePeriodStart: undefined,
      usagePeriodEnd: undefined,
      metadata: undefined
    });

    expect(recordPayment).toHaveBeenCalledWith(
      baseClaims,
      "inv-1",
      13975,
      new Date("2024-04-05T12:00:00Z")
    );

    expect(result).toEqual(
      expect.objectContaining({
        invoiceId: "inv-1",
        status: "PAID",
        subtotalCents: 13000,
        taxCents: 975,
        totalCents: 13975,
        lineCount: 3
      })
    );
  });

  it("throws when subscription reference is invalid", async () => {
    const deps = buildDeps({
      getSubscription: vi.fn().mockResolvedValue(null)
    });

    await expect(
      processBillingInvoiceJob(
        {
          organizationId: "org-1",
          subscriptionId: "missing",
          periodStart: "2024-04-01T00:00:00Z",
          periodEnd: "2024-04-30T23:59:59Z"
        },
        deps
      )
    ).rejects.toThrow("Subscription missing not found");
  });
});
