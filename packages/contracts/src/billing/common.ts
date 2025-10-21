import { z } from "zod";

export const BillingMetadataSchema = z.record(z.any()).nullable();

export const BillingIntervalValues = ["MONTHLY", "YEARLY"] as const;
export const BillingIntervalSchema = z.enum(BillingIntervalValues);

export const BillingLimitTypeValues = ["HARD", "SOFT", "UNLIMITED"] as const;
export const BillingLimitTypeSchema = z.enum(BillingLimitTypeValues);

export const BillingUsagePeriodValues = ["DAILY", "WEEKLY", "MONTHLY", "ANNUAL", "LIFETIME"] as const;
export const BillingUsagePeriodSchema = z.enum(BillingUsagePeriodValues);

export const BillingSubscriptionStatusValues = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED"
] as const;
export const BillingSubscriptionStatusSchema = z.enum(BillingSubscriptionStatusValues);

export const BillingSubscriptionScheduleStatusValues = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELED"] as const;
export const BillingSubscriptionScheduleStatusSchema = z.enum(BillingSubscriptionScheduleStatusValues);

export const BillingUsageSourceValues = ["PORTAL", "TASKS", "ADMIN", "WORKER", "API"] as const;
export const BillingUsageSourceSchema = z.enum(BillingUsageSourceValues);

export const BillingUsageResolutionValues = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;
export const BillingUsageResolutionSchema = z.enum(BillingUsageResolutionValues);

export const BillingInvoiceStatusValues = ["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"] as const;
export const BillingInvoiceStatusSchema = z.enum(BillingInvoiceStatusValues);

export const BillingInvoiceLineTypeValues = ["RECURRING", "USAGE", "ONE_TIME", "CREDIT", "TAX", "ADJUSTMENT"] as const;
export const BillingInvoiceLineTypeSchema = z.enum(BillingInvoiceLineTypeValues);

export const BillingPaymentMethodTypeValues = ["CARD", "BANK_ACCOUNT", "EXTERNAL"] as const;
export const BillingPaymentMethodTypeSchema = z.enum(BillingPaymentMethodTypeValues);

export const BillingPaymentMethodStatusValues = ["ACTIVE", "INACTIVE"] as const;
export const BillingPaymentMethodStatusSchema = z.enum(BillingPaymentMethodStatusValues);

export const BillingCreditReasonValues = ["ADJUSTMENT", "REFUND", "PROMOTION", "SERVICE_FAILURE", "OTHER"] as const;
export const BillingCreditReasonSchema = z.enum(BillingCreditReasonValues);

export const BillingContactRoleValues = ["primary", "finance", "technical", "legal"] as const;
export const BillingContactRoleSchema = z.enum(BillingContactRoleValues);

export const BillingFeatureLimitSchema = z.object({
  featureKey: z.string().min(1),
  limitType: BillingLimitTypeSchema,
  limitValue: z.number().int().nonnegative().nullable(),
  limitUnit: z.string().min(1).nullable(),
  usagePeriod: BillingUsagePeriodSchema.nullable(),
  metadata: BillingMetadataSchema
});
export type BillingFeatureLimit = z.infer<typeof BillingFeatureLimitSchema>;

export const BillingPackageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  active: z.boolean(),
  currency: z.string().min(1),
  interval: BillingIntervalSchema,
  amountCents: z.number().int().nonnegative(),
  trialPeriodDays: z.number().int().nonnegative().nullable(),
  metadata: BillingMetadataSchema,
  featureLimits: z.array(BillingFeatureLimitSchema)
});
export type BillingPackage = z.infer<typeof BillingPackageSchema>;

export const BillingPackageSummarySchema = BillingPackageSchema.pick({
  id: true,
  slug: true,
  name: true,
  description: true,
  currency: true,
  interval: true,
  amountCents: true,
  trialPeriodDays: true
}).extend({
  featureLimits: z.array(BillingFeatureLimitSchema).default([])
});
export type BillingPackageSummary = z.infer<typeof BillingPackageSummarySchema>;

export const BillingSubscriptionSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  packageId: z.string().min(1),
  status: BillingSubscriptionStatusSchema,
  currency: z.string().min(1),
  amountCents: z.number().int(),
  billingInterval: BillingIntervalSchema,
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  trialEndsAt: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().datetime().nullable(),
  externalId: z.string().nullable(),
  metadata: BillingMetadataSchema,
  package: BillingPackageSummarySchema.optional()
});
export type BillingSubscription = z.infer<typeof BillingSubscriptionSchema>;

export const BillingSubscriptionScheduleSchema = z.object({
  id: z.string().min(1),
  subscriptionId: z.string().min(1),
  targetPackageId: z.string().min(1),
  status: BillingSubscriptionScheduleStatusSchema,
  effectiveAt: z.string().datetime(),
  metadata: BillingMetadataSchema,
  targetPackage: BillingPackageSummarySchema.optional()
});
export type BillingSubscriptionSchedule = z.infer<typeof BillingSubscriptionScheduleSchema>;

export const BillingUsageDataPointSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  quantity: z.string().min(1),
  unit: z.string().min(1),
  source: BillingUsageSourceSchema
});
export type BillingUsageDataPoint = z.infer<typeof BillingUsageDataPointSchema>;

export const BillingUsageSummarySchema = z.object({
  featureKey: z.string().min(1),
  resolution: BillingUsageResolutionSchema,
  totalQuantity: z.string().min(1),
  unit: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  limitType: BillingLimitTypeSchema.nullable(),
  limitValue: z.number().int().nonnegative().nullable(),
  limitUnit: z.string().nullable(),
  usagePeriod: BillingUsagePeriodSchema.nullable(),
  percentageUsed: z.number().min(0).max(100).nullable()
});
export type BillingUsageSummary = z.infer<typeof BillingUsageSummarySchema>;

export const BillingInvoiceLineSchema = z.object({
  id: z.string().min(1),
  invoiceId: z.string().min(1),
  lineType: BillingInvoiceLineTypeSchema,
  description: z.string().nullable(),
  featureKey: z.string().nullable(),
  quantity: z.string().min(1),
  unitAmountCents: z.number().int(),
  amountCents: z.number().int(),
  usagePeriodStart: z.string().datetime().nullable(),
  usagePeriodEnd: z.string().datetime().nullable(),
  metadata: BillingMetadataSchema
});
export type BillingInvoiceLine = z.infer<typeof BillingInvoiceLineSchema>;

export const BillingInvoiceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  subscriptionId: z.string().nullable(),
  number: z.string().min(1),
  status: BillingInvoiceStatusSchema,
  currency: z.string().min(1),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  balanceCents: z.number().int(),
  dueAt: z.string().datetime().nullable(),
  issuedAt: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  externalId: z.string().nullable(),
  metadata: BillingMetadataSchema,
  lines: z.array(BillingInvoiceLineSchema).optional()
});
export type BillingInvoice = z.infer<typeof BillingInvoiceSchema>;

export const BillingPaymentMethodSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  type: BillingPaymentMethodTypeSchema,
  status: BillingPaymentMethodStatusSchema,
  providerId: z.string().min(1),
  reference: z.string().nullable(),
  brand: z.string().nullable(),
  last4: z.string().nullable(),
  expMonth: z.number().int().nonnegative().nullable(),
  expYear: z.number().int().nonnegative().nullable(),
  isDefault: z.boolean(),
  metadata: BillingMetadataSchema
});
export type BillingPaymentMethod = z.infer<typeof BillingPaymentMethodSchema>;

export const BillingCreditMemoSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  invoiceId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string().min(1),
  reason: BillingCreditReasonSchema,
  expiresAt: z.string().datetime().nullable(),
  metadata: BillingMetadataSchema
});
export type BillingCreditMemo = z.infer<typeof BillingCreditMemoSchema>;

export const BillingContactSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role: BillingContactRoleSchema,
  phone: z.string().nullable().optional(),
  metadata: BillingMetadataSchema.optional()
});
export type BillingContact = z.infer<typeof BillingContactSchema>;

export const BillingTaxIdSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  value: z.string().min(1),
  country: z.string().length(2).optional(),
  verified: z.boolean().optional()
});
export type BillingTaxId = z.infer<typeof BillingTaxIdSchema>;
