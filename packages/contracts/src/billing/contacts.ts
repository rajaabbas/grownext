import { z } from "zod";
import { BillingContactSchema, BillingMetadataSchema, BillingTaxIdSchema } from "./common";

export const PortalBillingContactsUpdateRequestSchema = z.object({
  contacts: z.array(BillingContactSchema),
  notes: z.string().max(1000).optional()
});
export type PortalBillingContactsUpdateRequest = z.infer<typeof PortalBillingContactsUpdateRequestSchema>;

export const PortalBillingTaxInfoUpdateRequestSchema = z.object({
  taxIds: z.array(BillingTaxIdSchema),
  metadata: BillingMetadataSchema.optional()
});
export type PortalBillingTaxInfoUpdateRequest = z.infer<typeof PortalBillingTaxInfoUpdateRequestSchema>;

export const PortalBillingContactsResponseSchema = z.object({
  contacts: z.array(BillingContactSchema),
  taxIds: z.array(BillingTaxIdSchema)
});
export type PortalBillingContactsResponse = z.infer<typeof PortalBillingContactsResponseSchema>;
