"use strict";

import { z } from "zod";
import { logger, env } from "@ma/core";
import {
  BillingInvoiceStatusValues,
  BillingInvoiceLineTypeValues,
  BillingUsageResolutionValues
} from "@ma/contracts";
import { createBillingInvoice } from "@ma/identity-client";

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

export interface BillingInvoiceProcessorDeps {
  createInvoice: (payload: InvoiceJobPayload) => Promise<BillingInvoiceProcessorResult>;
}

const createDefaultDeps = (): BillingInvoiceProcessorDeps => {
  const accessToken = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to process billing invoice jobs");
  }
  return {
    createInvoice: (payload) => createBillingInvoice(accessToken, payload)
  };
};

export interface BillingInvoiceProcessorResult {
  invoiceId: string;
  status: typeof BillingInvoiceStatusValues[number];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineCount: number;
  durationMs: number;
}

export const processBillingInvoiceJob = async (
  rawPayload: unknown,
  deps: BillingInvoiceProcessorDeps = createDefaultDeps()
): Promise<BillingInvoiceProcessorResult> => {
  const payload = invoiceJobSchema.parse(rawPayload);
  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);

  if (periodEnd <= periodStart) {
    throw new Error("periodEnd must be later than periodStart");
  }

  logger.info(
    {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId ?? null,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      usageCharges: payload.usageCharges.length,
      extraLines: payload.extraLines.length,
      settle: Boolean(payload.settle)
    },
    "Processing billing invoice job"
  );

  const result = await deps.createInvoice(payload);

  logger.info(
    {
      invoiceId: result.invoiceId,
      organizationId: payload.organizationId,
      status: result.status,
      subtotalCents: result.subtotalCents,
      taxCents: result.taxCents,
      totalCents: result.totalCents,
      lineCount: result.lineCount,
      durationMs: Number(result.durationMs.toFixed(2))
    },
    "Billing invoice job completed"
  );

  return result;
};
