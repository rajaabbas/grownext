import { z } from "zod";
import {
  BillingInvoiceSchema,
  BillingSubscriptionSchema,
  BillingUsageSummarySchema,
  BillingPackageSchema,
  BillingMetadataSchema
} from "./common";
import { BillingUsageSeriesSchema, BillingUsageQuerySchema } from "./usage";

export const AdminBillingSubscriptionListResponseSchema = z.object({
  subscriptions: z.array(BillingSubscriptionSchema)
});
export type AdminBillingSubscriptionListResponse = z.infer<
  typeof AdminBillingSubscriptionListResponseSchema
>;

export const AdminBillingInvoiceListResponseSchema = z.object({
  invoices: z.array(BillingInvoiceSchema)
});
export type AdminBillingInvoiceListResponse = z.infer<typeof AdminBillingInvoiceListResponseSchema>;

export const AdminBillingUsageResponseSchema = z.object({
  series: z.array(BillingUsageSeriesSchema),
  summaries: z.array(BillingUsageSummarySchema)
});
export type AdminBillingUsageResponse = z.infer<typeof AdminBillingUsageResponseSchema>;

export const AdminBillingUsageQuerySchema = BillingUsageQuerySchema.extend({
  organizationId: z.string().min(1).optional()
});
export type AdminBillingUsageQuery = z.infer<typeof AdminBillingUsageQuerySchema>;

export const AdminBillingCatalogResponseSchema = z.object({
  packages: z.array(BillingPackageSchema),
  metadata: BillingMetadataSchema.optional()
});
export type AdminBillingCatalogResponse = z.infer<typeof AdminBillingCatalogResponseSchema>;
