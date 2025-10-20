import { z } from "zod";
import { PortalRolePermissionsSchema } from "./portal-permissions";

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

export const PortalAdminActionSchema = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.string().min(1),
  actor: z
    .object({
      id: z.string().min(1).nullable(),
      email: z.string().email().nullable(),
      name: z.string().nullable()
    })
    .nullable(),
  tenant: z
    .object({
      id: z.string().min(1).nullable(),
      name: z.string().nullable()
    })
    .nullable(),
  metadata: z.record(z.any()).nullable()
});

export const PortalNotificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["bulk-job"]),
  title: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.string().min(1),
  actionUrl: z.string().min(1).nullable(),
  meta: z.record(z.any()).nullable()
});

export const PortalImpersonationStateSchema = z.object({
  tokenId: z.string().min(1),
  startedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  reason: z.string().nullable(),
  productSlug: z.string().nullable(),
  initiatedBy: z
    .object({
      id: z.string().min(1).nullable(),
      email: z.string().email().nullable(),
      name: z.string().nullable()
    })
    .nullable()
});

export const PortalSupportLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  description: z.string().nullable(),
  external: z.boolean().default(true)
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
  rolePermissions: z.array(PortalRolePermissionsSchema),
  products: z.array(PortalLauncherProductSchema),
  sessions: z.array(PortalSessionSummarySchema),
  tenantMembersCount: z.number().int().nonnegative(),
  adminActions: z.array(PortalAdminActionSchema).default([]),
  notifications: z.array(PortalNotificationSchema).default([]),
  impersonation: PortalImpersonationStateSchema.nullable().default(null),
  supportLinks: z.array(PortalSupportLinkSchema).default([])
});

export type PortalLauncherResponse = z.infer<typeof PortalLauncherResponseSchema>;
export type PortalLauncherProduct = z.infer<typeof PortalLauncherProductSchema>;
export type PortalTenantSummary = z.infer<typeof PortalTenantSummarySchema>;
export type PortalSessionSummary = z.infer<typeof PortalSessionSummarySchema>;
export type PortalAdminAction = z.infer<typeof PortalAdminActionSchema>;
export type PortalNotification = z.infer<typeof PortalNotificationSchema>;
export type PortalImpersonationState = z.infer<typeof PortalImpersonationStateSchema>;
export type PortalSupportLink = z.infer<typeof PortalSupportLinkSchema>;
