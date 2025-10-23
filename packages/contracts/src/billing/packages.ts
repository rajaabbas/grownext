import { z } from "zod";
import {
  BillingIntervalSchema,
  BillingMetadataSchema,
  BillingPackageSchema,
  BillingUsagePeriodSchema,
  BillingLimitTypeSchema
} from "./common";

export const BillingFeatureLimitInputSchema = z.object({
  id: z.string().min(1).optional(),
  featureKey: z.string().min(1),
  limitType: BillingLimitTypeSchema,
  limitValue: z.number().int().nonnegative().nullable(),
  limitUnit: z.string().nullable(),
  usagePeriod: BillingUsagePeriodSchema.nullable(),
  metadata: BillingMetadataSchema.optional()
});
export type BillingFeatureLimitInput = z.infer<typeof BillingFeatureLimitInputSchema>;

export const BillingPackageMutationSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
  currency: z.string().min(1).optional(),
  interval: BillingIntervalSchema.optional(),
  amountCents: z.number().int().nonnegative().optional(),
  trialPeriodDays: z.number().int().nonnegative().nullable().optional(),
  metadata: BillingMetadataSchema.optional(),
  featureLimits: z.array(BillingFeatureLimitInputSchema).optional()
});
export type BillingPackageMutation = z.infer<typeof BillingPackageMutationSchema>;

export const AdminBillingPackageCreateRequestSchema = BillingPackageMutationSchema.extend({
  slug: z.string().min(1),
  currency: z.string().min(1),
  interval: BillingIntervalSchema,
  amountCents: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  featureLimits: z.array(BillingFeatureLimitInputSchema).default([])
});
export type AdminBillingPackageCreateRequest = z.infer<typeof AdminBillingPackageCreateRequestSchema>;

export const AdminBillingPackageUpdateRequestSchema = BillingPackageMutationSchema.extend({
  featureLimits: z.array(BillingFeatureLimitInputSchema).optional()
});
export type AdminBillingPackageUpdateRequest = z.infer<typeof AdminBillingPackageUpdateRequestSchema>;

export const AdminBillingPackageListResponseSchema = z.object({
  packages: z.array(BillingPackageSchema)
});
export type AdminBillingPackageListResponse = z.infer<typeof AdminBillingPackageListResponseSchema>;
