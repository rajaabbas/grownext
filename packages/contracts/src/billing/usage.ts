import { z } from "zod";
import {
  BillingUsageResolutionSchema,
  BillingUsageDataPointSchema,
  BillingUsageSummarySchema
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
