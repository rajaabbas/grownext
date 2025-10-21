import { z } from "zod";
import {
  BillingContactSchema,
  BillingInvoiceSchema,
  BillingPackageSchema,
  BillingPaymentMethodSchema,
  BillingSubscriptionSchema,
  BillingSubscriptionScheduleSchema,
  BillingTaxIdSchema,
  BillingUsageSummarySchema,
  BillingMetadataSchema
} from "./common";
import { PortalBillingUsageResponseSchema } from "./usage";
import { PortalBillingContactsResponseSchema } from "./contacts";

export const PortalBillingLimitWarningSchema = z.object({
  featureKey: z.string().min(1),
  status: z.enum(["approaching", "exceeded"]),
  thresholdPercent: z.number().min(0).max(100),
  currentPercent: z.number().min(0),
  message: z.string().min(1)
});
export type PortalBillingLimitWarning = z.infer<typeof PortalBillingLimitWarningSchema>;

export const PortalBillingOverviewSchema = z.object({
  organizationId: z.string().min(1),
  subscription: BillingSubscriptionSchema.nullable(),
  activePackage: BillingPackageSchema.nullable(),
  scheduledChanges: z.array(BillingSubscriptionScheduleSchema).default([]),
  usageSummaries: z.array(BillingUsageSummarySchema).default([]),
  paymentMethods: z.array(BillingPaymentMethodSchema).default([]),
  defaultPaymentMethodId: z.string().nullable().default(null),
  contacts: z.array(BillingContactSchema).default([]),
  taxIds: z.array(BillingTaxIdSchema).default([]),
  outstandingBalanceCents: z.number().int().nonnegative(),
  upcomingInvoice: BillingInvoiceSchema.nullable(),
  recentInvoices: z.array(BillingInvoiceSchema).default([]),
  featureWarnings: z.array(PortalBillingLimitWarningSchema).default([]),
  metadata: BillingMetadataSchema.optional(),
  lastUpdated: z.string().datetime()
});
export type PortalBillingOverview = z.infer<typeof PortalBillingOverviewSchema>;

export const PortalBillingOverviewResponseSchema = z.object({
  overview: PortalBillingOverviewSchema,
  usage: PortalBillingUsageResponseSchema.optional(),
  contacts: PortalBillingContactsResponseSchema.optional()
});
export type PortalBillingOverviewResponse = z.infer<typeof PortalBillingOverviewResponseSchema>;
