import { z } from "zod";
import {
  BillingInvoiceSchema,
  BillingInvoiceStatusSchema,
  BillingMetadataSchema,
  BillingCreditMemoSchema
} from "./common";

export const PortalBillingInvoiceListResponseSchema = z.object({
  invoices: z.array(BillingInvoiceSchema)
});
export type PortalBillingInvoiceListResponse = z.infer<typeof PortalBillingInvoiceListResponseSchema>;

export const AdminBillingInvoiceStatusUpdateRequestSchema = z.object({
  status: BillingInvoiceStatusSchema,
  paidAt: z.string().datetime().nullable().optional(),
  voidedAt: z.string().datetime().nullable().optional(),
  balanceCents: z.number().int().nonnegative().nullable().optional(),
  metadata: BillingMetadataSchema.optional()
});
export type AdminBillingInvoiceStatusUpdateRequest = z.infer<
  typeof AdminBillingInvoiceStatusUpdateRequestSchema
>;

export const AdminBillingCreditIssueRequestSchema = z.object({
  invoiceId: z.string().min(1).nullable(),
  amountCents: z.number().int(),
  currency: z.string().min(1).optional(),
  reason: z.string().min(1),
  metadata: BillingMetadataSchema.optional()
});
export type AdminBillingCreditIssueRequest = z.infer<typeof AdminBillingCreditIssueRequestSchema>;

export const AdminBillingCreditListResponseSchema = z.object({
  credits: z.array(BillingCreditMemoSchema)
});
export type AdminBillingCreditListResponse = z.infer<typeof AdminBillingCreditListResponseSchema>;
