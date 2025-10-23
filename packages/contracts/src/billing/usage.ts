import { z } from "zod";
import {
  BillingUsageResolutionSchema,
  BillingUsageDataPointSchema,
  BillingUsageSummarySchema,
  BillingUsageSourceSchema
} from "./common";

export const BillingUsageQuerySchema = z.object({
  featureKey: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  resolution: BillingUsageResolutionSchema.optional(),
  tenantId: z.string().min(1).optional(),
  productId: z.string().min(1).optional()
});
export type BillingUsageQuery = z.infer<typeof BillingUsageQuerySchema>;

export const BillingUsageSeriesSchema = z.object({
  featureKey: z.string().min(1),
  unit: z.string().min(1),
  resolution: BillingUsageResolutionSchema,
  points: z.array(BillingUsageDataPointSchema)
});
export type BillingUsageSeries = z.infer<typeof BillingUsageSeriesSchema>;

export const PortalBillingUsageResponseSchema = z.object({
  series: z.array(BillingUsageSeriesSchema),
  summaries: z.array(BillingUsageSummarySchema)
});
export type PortalBillingUsageResponse = z.infer<typeof PortalBillingUsageResponseSchema>;

const UsageQuantitySchema = z.union([z.number().finite(), z.string().min(1)]);
const UsageRecordedAtSchema = z.union([z.string().datetime(), z.date()]);

export const BillingUsageEventInputSchema = z.object({
  organizationId: z.string().min(1),
  subscriptionId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  featureKey: z.string().min(1),
  quantity: UsageQuantitySchema,
  unit: z.string().min(1),
  recordedAt: UsageRecordedAtSchema.optional(),
  source: BillingUsageSourceSchema.optional(),
  metadata: z.record(z.any()).nullable().optional(),
  fingerprint: z.string().min(1).optional()
});
export type BillingUsageEventInput = z.infer<typeof BillingUsageEventInputSchema>;

export const BillingUsageEventsResultSchema = z.object({
  accepted: z.number().int().nonnegative()
});
export type BillingUsageEventsResult = z.infer<typeof BillingUsageEventsResultSchema>;
