import { z } from "zod";

export const PortalLauncherProductSchema = z.object({
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  iconUrl: z.string().url().nullable(),
  launchUrl: z.string().url(),
  roles: z.array(z.string().min(1)),
  lastUsedAt: z.string().nullable()
});

export const PortalTenantSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  description: z.string().nullable(),
  membersCount: z.number().int().nonnegative(),
  productsCount: z.number().int().nonnegative()
});

export const PortalSessionSummarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  description: z.string().nullable(),
  productId: z.string().nullable(),
  tenantId: z.string().nullable(),
  revokedAt: z.string().nullable()
});

export const PortalLauncherResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    fullName: z.string().min(1),
    organizationId: z.string().min(1),
    organizationName: z.string().min(1),
    organizationRole: z.string().min(1),
    tenantMemberships: z.array(
      z.object({
        tenantId: z.string().min(1),
        role: z.string().min(1)
      })
    ),
    entitlements: z.array(
      z.object({
        productId: z.string().min(1),
        productSlug: z.string().min(1),
        productName: z.string().min(1),
        tenantId: z.string().min(1),
        tenantName: z.string().min(1).nullable(),
        roles: z.array(z.string().min(1))
      })
    )
  }),
  tenants: z.array(PortalTenantSummarySchema),
  products: z.array(PortalLauncherProductSchema),
  sessions: z.array(PortalSessionSummarySchema)
});

export type PortalLauncherResponse = z.infer<typeof PortalLauncherResponseSchema>;
export type PortalLauncherProduct = z.infer<typeof PortalLauncherProductSchema>;
export type PortalTenantSummary = z.infer<typeof PortalTenantSummarySchema>;
export type PortalSessionSummary = z.infer<typeof PortalSessionSummarySchema>;
