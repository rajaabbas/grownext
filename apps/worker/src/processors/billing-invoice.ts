"use strict";

import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logger, buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  prisma,
  Prisma,
  getBillingSubscriptionById,
  getActiveBillingSubscriptionForOrganization,
  createBillingInvoice,
  addBillingInvoiceLine,
  recordBillingInvoicePayment,
  type BillingSubscription,
  type BillingInvoice
} from "@ma/db";
import {
  BillingInvoiceStatusValues,
  BillingInvoiceLineTypeValues,
  BillingUsageResolutionValues
} from "@ma/contracts";
import type { BillingInvoiceLineType, BillingInvoiceStatus, BillingUsageResolution } from "@ma/db";

const usageChargeSchema = z.object({
  featureKey: z.string().min(1),
  unitAmountCents: z.number().int().nonnegative(),
  unit: z.string().min(1),
  description: z.string().optional(),
  minimumAmountCents: z.number().int().nonnegative().optional(),
  resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
  usagePeriodStart: z.string().datetime().optional(),
  usagePeriodEnd: z.string().datetime().optional()
});

const extraLineSchema = z.object({
  lineType: z.enum(BillingInvoiceLineTypeValues).default("ADJUSTMENT"),
  description: z.string().optional(),
  featureKey: z.string().optional(),
  quantity: z.number().finite().default(1),
  unitAmountCents: z.number().int(),
  amountCents: z.number().int(),
  usagePeriodStart: z.string().datetime().optional(),
  usagePeriodEnd: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

const invoiceJobSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  subscriptionId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  currency: z.string().min(3).default("usd"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  recurringAmountCents: z.number().int().nonnegative().optional(),
  recurringDescription: z.string().optional(),
  status: z.enum(BillingInvoiceStatusValues).default("OPEN"),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  taxCents: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
  usageCharges: z.array(usageChargeSchema).default([]),
  extraLines: z.array(extraLineSchema).default([]),
  settle: z
    .object({
      amountCents: z.number().int().nonnegative().optional(),
      paidAt: z.string().datetime().optional()
    })
    .optional()
});

type InvoiceJobPayload = z.infer<typeof invoiceJobSchema>;

interface UsageTotalsInput {
  organizationId: string;
  subscriptionId: string | null;
  periodStart: Date;
  periodEnd: Date;
  charges: Array<{ featureKey: string; resolution: BillingUsageResolution }>;
}

interface UsageTotalsAccumulator {
  quantity: Prisma.Decimal;
  unit: string | null;
}

interface PreparedInvoiceLine {
  lineType: BillingInvoiceLineType;
  description?: string | null;
  featureKey?: string | null;
  quantity: Prisma.Decimal | number | string;
  unitAmountCents: number;
  amountCents: number;
  usagePeriodStart?: Date | null;
  usagePeriodEnd?: Date | null;
  metadata?: Prisma.JsonValue | null;
}

export interface BillingInvoiceProcessorDeps {
  getSubscription: (
    claims: SupabaseJwtClaims,
    subscriptionId: string
  ) => Promise<BillingSubscription | null>;
  getActiveSubscription: (
    claims: SupabaseJwtClaims,
    organizationId: string
  ) => Promise<BillingSubscription | null>;
  createInvoice: (claims: SupabaseJwtClaims, input: Parameters<typeof createBillingInvoice>[1]) => Promise<BillingInvoice>;
  addInvoiceLine: (
    claims: SupabaseJwtClaims,
    input: Parameters<typeof addBillingInvoiceLine>[1]
  ) => Promise<unknown>;
  fetchUsageTotals: (input: UsageTotalsInput) => Promise<Map<string, UsageTotalsAccumulator>>;
  recordPayment: (
    claims: SupabaseJwtClaims,
    invoiceId: string,
    amountCents: number,
    paidAt: Date
  ) => Promise<BillingInvoice>;
  buildClaims: (organizationId: string) => SupabaseJwtClaims;
}

const keyForUsageTotal = (featureKey: string, resolution: BillingUsageResolution) =>
  `${featureKey}::${resolution}`;

const defaultDeps: BillingInvoiceProcessorDeps = {
  getSubscription: (claims, subscriptionId) =>
    getBillingSubscriptionById(claims, subscriptionId),
  getActiveSubscription: (claims, organizationId) =>
    getActiveBillingSubscriptionForOrganization(claims, organizationId),
  createInvoice: createBillingInvoice,
  addInvoiceLine: addBillingInvoiceLine,
  fetchUsageTotals: async (input) => {
    const totals = new Map<string, UsageTotalsAccumulator>();

    if (!input.subscriptionId || input.charges.length === 0) {
      return totals;
    }

    const featureKeys = Array.from(new Set(input.charges.map((charge) => charge.featureKey)));
    const resolutions = Array.from(new Set(input.charges.map((charge) => charge.resolution)));

    for (const charge of input.charges) {
      totals.set(keyForUsageTotal(charge.featureKey, charge.resolution), {
        quantity: new Prisma.Decimal(0),
        unit: null
      });
    }

    const rows = await prisma.billingUsageAggregate.findMany({
      where: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        featureKey: { in: featureKeys },
        resolution: { in: resolutions },
        periodStart: { gte: input.periodStart },
        periodEnd: { lte: input.periodEnd }
      }
    });

    for (const row of rows) {
      const key = keyForUsageTotal(row.featureKey, row.resolution);
      const accumulator = totals.get(key);
      if (!accumulator) {
        continue;
      }
      accumulator.quantity = accumulator.quantity.plus(row.quantity);
      accumulator.unit = row.unit;
    }

    return totals;
  },
  recordPayment: recordBillingInvoicePayment,
  buildClaims: buildServiceRoleClaims
};

const formatDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const generateInvoiceNumber = (organizationId: string, issuedAt: Date): string => {
  const suffix = organizationId.slice(-6).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || randomUUID().slice(0, 6).toUpperCase();
  return `INV-${formatDateKey(issuedAt)}-${suffix}`;
};

export interface BillingInvoiceProcessorResult {
  invoiceId: string;
  status: BillingInvoiceStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineCount: number;
  durationMs: number;
}

export const processBillingInvoiceJob = async (
  rawPayload: unknown,
  deps: BillingInvoiceProcessorDeps = defaultDeps
): Promise<BillingInvoiceProcessorResult> => {
  const startedAt = performance.now();
  const payload = invoiceJobSchema.parse(rawPayload);
  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);

  if (periodEnd <= periodStart) {
    throw new Error("periodEnd must be later than periodStart");
  }

  const claims = deps.buildClaims(payload.organizationId);

  let subscription: BillingSubscription | null = null;
  if (payload.subscriptionId) {
    subscription = await deps.getSubscription(claims, payload.subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${payload.subscriptionId} not found`);
    }
  } else {
    subscription = await deps.getActiveSubscription(claims, payload.organizationId);
  }

  const subscriptionId = subscription?.id ?? null;

  const preparedLines: PreparedInvoiceLine[] = [];
  let subtotalCents = 0;

  const recurringAmount =
    payload.recurringAmountCents ??
    (subscription ? subscription.amountCents : undefined);

  if (recurringAmount !== undefined) {
    subtotalCents += recurringAmount;
    preparedLines.push({
      lineType: "RECURRING",
      description:
        payload.recurringDescription ??
        (subscription
          ? `${subscription.billingInterval.toLowerCase()} subscription`
          : "Subscription charges"),
      featureKey: "subscription",
      quantity: 1,
      unitAmountCents: recurringAmount,
      amountCents: recurringAmount
    });
  }

  if (payload.usageCharges.length > 0) {
    const usageTotals = await deps.fetchUsageTotals({
      organizationId: payload.organizationId,
      subscriptionId,
      periodStart,
      periodEnd,
      charges: payload.usageCharges.map((charge) => ({
        featureKey: charge.featureKey,
        resolution: charge.resolution as BillingUsageResolution
      }))
    });

    for (const charge of payload.usageCharges) {
      const resolution = charge.resolution as BillingUsageResolution;
      const key = keyForUsageTotal(charge.featureKey, resolution);
      const total = usageTotals.get(key);
      const quantity = total?.quantity ?? new Prisma.Decimal(0);
      const computed = new Prisma.Decimal(charge.unitAmountCents).mul(quantity);
      let amountCents = Number(computed.toFixed(0));
      if (charge.minimumAmountCents !== undefined) {
        amountCents = Math.max(amountCents, charge.minimumAmountCents);
      }

      if (amountCents === 0 && !charge.minimumAmountCents) {
        continue;
      }

      subtotalCents += amountCents;
      preparedLines.push({
        lineType: "USAGE",
        description: charge.description ?? `Usage for ${charge.featureKey}`,
        featureKey: charge.featureKey,
        quantity,
        unitAmountCents: charge.unitAmountCents,
        amountCents,
        usagePeriodStart: charge.usagePeriodStart
          ? new Date(charge.usagePeriodStart)
          : periodStart,
        usagePeriodEnd: charge.usagePeriodEnd ? new Date(charge.usagePeriodEnd) : periodEnd
      });
    }
  }

  for (const line of payload.extraLines) {
    subtotalCents += line.amountCents;
    preparedLines.push({
      lineType: line.lineType as BillingInvoiceLineType,
      description: line.description ?? null,
      featureKey: line.featureKey ?? null,
      quantity: new Prisma.Decimal(line.quantity ?? 1),
      unitAmountCents: line.unitAmountCents,
      amountCents: line.amountCents,
      usagePeriodStart: line.usagePeriodStart ? new Date(line.usagePeriodStart) : null,
      usagePeriodEnd: line.usagePeriodEnd ? new Date(line.usagePeriodEnd) : null,
      metadata: line.metadata ?? null
    });
  }

  if (preparedLines.length === 0 && !payload.taxCents && !payload.settle) {
    throw new Error("Invoice job did not produce any billable lines");
  }

  const issuedAt = payload.issueDate ? new Date(payload.issueDate) : new Date();
  const dueAt = payload.dueDate ? new Date(payload.dueDate) : periodEnd;
  const invoiceNumber = payload.invoiceNumber ?? generateInvoiceNumber(payload.organizationId, issuedAt);

  const taxCents =
    payload.taxCents ??
    (payload.taxRateBps !== undefined
      ? Math.round((subtotalCents * payload.taxRateBps) / 10000)
      : 0);

  const totalCents = subtotalCents + taxCents;

  const invoice = await deps.createInvoice(claims, {
    organizationId: payload.organizationId,
    subscriptionId,
    number: invoiceNumber,
    status: payload.status as BillingInvoiceStatus,
    currency: payload.currency,
    subtotalCents,
    taxCents,
    totalCents,
    balanceCents: totalCents,
    issuedAt,
    dueAt,
    metadata:
      payload.metadata !== undefined ? (payload.metadata as Prisma.JsonValue) : undefined
  });

  for (const line of preparedLines) {
    await deps.addInvoiceLine(claims, {
      invoiceId: invoice.id,
      lineType: line.lineType,
      description: line.description ?? undefined,
      featureKey: line.featureKey ?? undefined,
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      amountCents: line.amountCents,
      usagePeriodStart: line.usagePeriodStart ?? undefined,
      usagePeriodEnd: line.usagePeriodEnd ?? undefined,
      metadata:
        line.metadata !== undefined ? (line.metadata as Prisma.JsonValue | null) ?? null : undefined
    });
  }

  if (taxCents > 0) {
    await deps.addInvoiceLine(claims, {
      invoiceId: invoice.id,
      lineType: "TAX",
      description: "Tax",
      quantity: 1,
      unitAmountCents: taxCents,
      amountCents: taxCents
    });
  }

  let finalInvoice = invoice;
  if (payload.settle) {
    const amount = payload.settle.amountCents ?? totalCents;
    const paidAt = payload.settle.paidAt ? new Date(payload.settle.paidAt) : new Date();
    finalInvoice = await deps.recordPayment(claims, invoice.id, amount, paidAt);
  }

  const durationMs = performance.now() - startedAt;

  logger.info(
    {
      invoiceId: finalInvoice.id,
      organizationId: payload.organizationId,
      subscriptionId,
      subtotalCents,
      taxCents,
      totalCents,
      status: finalInvoice.status,
      lineCount: preparedLines.length + (taxCents > 0 ? 1 : 0),
      durationMs: Number(durationMs.toFixed(2))
    },
    "Billing invoice job completed"
  );

  return {
    invoiceId: finalInvoice.id,
    status: finalInvoice.status,
    subtotalCents,
    taxCents,
    totalCents,
    lineCount: preparedLines.length + (taxCents > 0 ? 1 : 0),
    durationMs
  };
};
