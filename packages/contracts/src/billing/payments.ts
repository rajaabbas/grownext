import { z } from "zod";
import {
  BillingMetadataSchema,
  BillingPaymentMethodSchema,
  BillingPaymentMethodStatusSchema,
  BillingPaymentMethodTypeSchema
} from "./common";

export const PortalBillingPaymentMethodUpsertRequestSchema = z.object({
  providerId: z.string().min(1),
  type: BillingPaymentMethodTypeSchema,
  reference: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  last4: z.string().min(2).max(4).nullable().optional(),
  expMonth: z.number().int().min(1).max(12).nullable().optional(),
  expYear: z.number().int().nonnegative().nullable().optional(),
  status: BillingPaymentMethodStatusSchema.optional(),
  setDefault: z.boolean().optional(),
  metadata: BillingMetadataSchema.optional()
});
export type PortalBillingPaymentMethodUpsertRequest = z.infer<
  typeof PortalBillingPaymentMethodUpsertRequestSchema
>;

export const PortalBillingSetDefaultPaymentMethodRequestSchema = z.object({
  paymentMethodId: z.string().min(1)
});
export type PortalBillingSetDefaultPaymentMethodRequest = z.infer<
  typeof PortalBillingSetDefaultPaymentMethodRequestSchema
>;

export const PortalBillingPaymentMethodsResponseSchema = z.object({
  paymentMethods: z.array(BillingPaymentMethodSchema),
  defaultPaymentMethodId: z.string().nullable()
});
export type PortalBillingPaymentMethodsResponse = z.infer<
  typeof PortalBillingPaymentMethodsResponseSchema
>;
