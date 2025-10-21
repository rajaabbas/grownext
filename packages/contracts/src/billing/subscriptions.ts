import { z } from "zod";
import {
  BillingMetadataSchema,
  BillingSubscriptionSchema,
  BillingSubscriptionScheduleSchema
} from "./common";

export const BillingSubscriptionChangeTimingValues = ["immediate", "period_end", "scheduled"] as const;
export const BillingSubscriptionChangeTimingSchema = z.enum(BillingSubscriptionChangeTimingValues);

export const PortalBillingSubscriptionChangeRequestSchema = z.object({
  packageId: z.string().min(1),
  timing: BillingSubscriptionChangeTimingSchema.default("period_end"),
  effectiveAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
  metadata: BillingMetadataSchema.optional()
});
export type PortalBillingSubscriptionChangeRequest = z.infer<typeof PortalBillingSubscriptionChangeRequestSchema>;

export const PortalBillingSubscriptionChangeResponseSchema = z.object({
  subscription: BillingSubscriptionSchema,
  schedules: z.array(BillingSubscriptionScheduleSchema).default([])
});
export type PortalBillingSubscriptionChangeResponse = z.infer<
  typeof PortalBillingSubscriptionChangeResponseSchema
>;

export const PortalBillingSubscriptionCancelRequestSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.string().max(500).optional()
});
export type PortalBillingSubscriptionCancelRequest = z.infer<
  typeof PortalBillingSubscriptionCancelRequestSchema
>;

export const AdminBillingSubscriptionOverrideRequestSchema = z.object({
  amountCents: z.number().int().nonnegative().optional(),
  billingInterval: z.string().optional(),
  notes: z.string().max(1000).optional(),
  metadata: BillingMetadataSchema.optional()
});
export type AdminBillingSubscriptionOverrideRequest = z.infer<
  typeof AdminBillingSubscriptionOverrideRequestSchema
>;
