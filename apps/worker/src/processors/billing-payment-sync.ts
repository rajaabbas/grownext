"use strict";

import { performance } from "node:perf_hooks";
import { z } from "zod";
import { logger, buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  getBillingInvoiceById,
  recordBillingInvoicePayment,
  updateBillingInvoiceStatus,
  createBillingCreditMemo,
  type BillingInvoice,
  type BillingInvoiceStatus
} from "@ma/db";
import { BillingInvoiceStatusValues, BillingCreditReasonValues } from "@ma/contracts";

const paymentSyncEvents = ["payment_succeeded", "payment_failed", "payment_disputed", "payment_refunded", "sync_status"] as const;

type PaymentSyncEvent = (typeof paymentSyncEvents)[number];

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
  getInvoice: (claims: SupabaseJwtClaims, invoiceId: string) => Promise<BillingInvoice | null>;
  recordPayment: (
    claims: SupabaseJwtClaims,
    invoiceId: string,
    amountCents: number,
    paidAt: Date
  ) => Promise<BillingInvoice>;
  updateInvoiceStatus: (
    claims: SupabaseJwtClaims,
    invoiceId: string,
    status: BillingInvoiceStatus,
    updates?: Parameters<typeof updateBillingInvoiceStatus>[3]
  ) => Promise<BillingInvoice>;
  createCreditMemo: (
    claims: SupabaseJwtClaims,
    input: Parameters<typeof createBillingCreditMemo>[1]
  ) => Promise<unknown>;
  buildClaims: (organizationId: string) => SupabaseJwtClaims;
}

const defaultDeps: BillingPaymentSyncProcessorDeps = {
  getInvoice: (claims, invoiceId) => getBillingInvoiceById(claims, invoiceId),
  recordPayment: recordBillingInvoicePayment,
  updateInvoiceStatus: (claims, invoiceId, status, updates) =>
    updateBillingInvoiceStatus(claims, invoiceId, status, updates),
  createCreditMemo: createBillingCreditMemo,
  buildClaims: buildServiceRoleClaims
};

export interface BillingPaymentSyncProcessorResult {
  invoiceId: string;
  status: BillingInvoiceStatus;
  action: "PAYMENT_RECORDED" | "STATUS_UPDATED" | "CREDIT_ISSUED";
  durationMs: number;
}

const resolveCreditAmount = (payload: PaymentSyncJobPayload, invoice: BillingInvoice): number => {
  if (payload.credit?.amountCents !== undefined) {
    return payload.credit.amountCents;
  }
  if (payload.amountCents !== undefined) {
    return payload.amountCents;
  }
  return invoice.balanceCents;
};

const resolveCreditReason = (payload: PaymentSyncJobPayload, fallback: "REFUND" | "SERVICE_FAILURE") =>
  payload.credit?.reason ?? fallback;

export const processBillingPaymentSyncJob = async (
  rawPayload: unknown,
  deps: BillingPaymentSyncProcessorDeps = defaultDeps
): Promise<BillingPaymentSyncProcessorResult> => {
  const startedAt = performance.now();
  const payload = paymentSyncJobSchema.parse(rawPayload);
  const claims = deps.buildClaims(payload.organizationId);

  const invoice = await deps.getInvoice(claims, payload.invoiceId);
  if (!invoice) {
    throw new Error(`Invoice ${payload.invoiceId} not found`);
  }

  logger.info(
    {
      invoiceId: invoice.id,
      organizationId: payload.organizationId,
      event: payload.event,
      amountCents: payload.amountCents ?? null,
      externalPaymentId: payload.externalPaymentId ?? null
    },
    "Processing billing payment sync job"
  );

  let updatedInvoice: BillingInvoice;
  let action: BillingPaymentSyncProcessorResult["action"];

  switch (payload.event) {
    case "payment_succeeded": {
      const amount = payload.amountCents ?? invoice.totalCents;
      const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
      updatedInvoice = await deps.recordPayment(claims, invoice.id, amount, paidAt);
      action = "PAYMENT_RECORDED";
      break;
    }
    case "payment_failed": {
      const status = payload.status ?? "UNCOLLECTIBLE";
      updatedInvoice = await deps.updateInvoiceStatus(claims, invoice.id, status, {
        metadata: payload.metadata ?? undefined
      });
      action = "STATUS_UPDATED";
      break;
    }
    case "payment_disputed": {
      const amount = resolveCreditAmount(payload, invoice);
      await deps.createCreditMemo(claims, {
        organizationId: payload.organizationId,
        invoiceId: invoice.id,
        amountCents: amount,
        currency: invoice.currency,
        reason: resolveCreditReason(payload, "SERVICE_FAILURE"),
        metadata: payload.credit?.metadata ?? payload.metadata ?? undefined
      });
      const status = payload.status ?? "UNCOLLECTIBLE";
      updatedInvoice = await deps.updateInvoiceStatus(claims, invoice.id, status, {
        metadata: payload.metadata ?? undefined
      });
      action = "CREDIT_ISSUED";
      break;
    }
    case "payment_refunded": {
      const amount = resolveCreditAmount(payload, invoice);
      await deps.createCreditMemo(claims, {
        organizationId: payload.organizationId,
        invoiceId: invoice.id,
        amountCents: amount,
        currency: invoice.currency,
        reason: resolveCreditReason(payload, "REFUND"),
        metadata: payload.credit?.metadata ?? payload.metadata ?? undefined
      });
      const status = payload.status ?? "VOID";
      const voidedAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
      updatedInvoice = await deps.updateInvoiceStatus(claims, invoice.id, status, {
        voidedAt,
        metadata: payload.metadata ?? undefined
      });
      action = "CREDIT_ISSUED";
      break;
    }
    case "sync_status": {
      const status = payload.status ?? invoice.status;
      updatedInvoice = await deps.updateInvoiceStatus(claims, invoice.id, status, {
        metadata: payload.metadata ?? undefined
      });
      action = "STATUS_UPDATED";
      break;
    }
    default: {
      // Exhaustiveness guard
      throw new Error(`Unhandled payment sync event: ${(payload as { event: string }).event}`);
    }
  }

  const durationMs = performance.now() - startedAt;

  logger.info(
    {
      invoiceId: updatedInvoice.id,
      status: updatedInvoice.status,
      action,
      durationMs: Number(durationMs.toFixed(2))
    },
    "Billing payment sync job completed"
  );

  return {
    invoiceId: updatedInvoice.id,
    status: updatedInvoice.status,
    action,
    durationMs
  };
};
