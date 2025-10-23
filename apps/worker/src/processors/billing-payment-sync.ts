"use strict";

import { z } from "zod";
import { logger, env } from "@ma/core";
import { BillingInvoiceStatusValues, BillingCreditReasonValues } from "@ma/contracts";
import { syncBillingPayment } from "@ma/identity-client";

const paymentSyncEvents = [
  "payment_succeeded",
  "payment_failed",
  "payment_disputed",
  "payment_refunded",
  "sync_status"
] as const;

const paymentSyncJobSchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  event: z.enum(paymentSyncEvents),
  amountCents: z.number().int().nonnegative().optional(),
  paidAt: z.string().datetime().optional(),
  status: z.enum(BillingInvoiceStatusValues).optional(),
  externalPaymentId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  note: z.string().optional(),
  credit: z
    .object({
      amountCents: z.number().int().nonnegative(),
      reason: z.enum(BillingCreditReasonValues).optional(),
      metadata: z.record(z.any()).optional()
    })
    .optional()
});

type PaymentSyncJobPayload = z.infer<typeof paymentSyncJobSchema>;

export interface BillingPaymentSyncProcessorDeps {
  syncPayment: (payload: PaymentSyncJobPayload) => Promise<BillingPaymentSyncProcessorResult>;
}

const createDefaultDeps = (): BillingPaymentSyncProcessorDeps => {
  const accessToken = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to process billing payment sync jobs");
  }
  return {
    syncPayment: (payload) => syncBillingPayment(accessToken, payload)
  };
};

export interface BillingPaymentSyncProcessorResult {
  invoiceId: string;
  status: typeof BillingInvoiceStatusValues[number];
  action: "PAYMENT_RECORDED" | "STATUS_UPDATED" | "CREDIT_ISSUED";
  durationMs: number;
}

export const processBillingPaymentSyncJob = async (
  rawPayload: unknown,
  deps: BillingPaymentSyncProcessorDeps = createDefaultDeps()
): Promise<BillingPaymentSyncProcessorResult> => {
  const payload = paymentSyncJobSchema.parse(rawPayload);

  logger.info(
    {
      invoiceId: payload.invoiceId,
      organizationId: payload.organizationId,
      event: payload.event,
      amountCents: payload.amountCents ?? null,
      externalPaymentId: payload.externalPaymentId ?? null
    },
    "Processing billing payment sync job"
  );

  const result = await deps.syncPayment(payload);

  logger.info(
    {
      invoiceId: result.invoiceId,
      status: result.status,
      action: result.action,
      durationMs: Number(result.durationMs.toFixed(2))
    },
    "Billing payment sync job completed"
  );

  return result;
};
