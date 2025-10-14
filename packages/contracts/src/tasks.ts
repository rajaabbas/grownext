import { z } from "zod";

export const TasksTenantSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  slug: z.string().min(1).nullable(),
  description: z.string().nullable(),
  membersCount: z.number().int().nonnegative(),
  productsCount: z.number().int().nonnegative()
});

export const TasksEntitlementSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  tenantId: z.string().min(1),
  tenantName: z.string().nullable(),
  roles: z.array(z.string().min(1)),
  expiresAt: z.string().nullable()
});

export const TasksContextSourceSchema = z.enum(["request", "metadata", "fallback"]);

export const TasksActiveTenantSchema = z.object({
  entitlementId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantName: z.string().nullable(),
  roles: z.array(z.string().min(1)),
  source: TasksContextSourceSchema
});

export const TasksContextResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    fullName: z.string().nullable()
  }),
  organization: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1).nullable()
  }),
  product: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1)
  }),
  entitlements: z.array(TasksEntitlementSchema),
  tenants: z.array(TasksTenantSummarySchema),
  activeTenant: TasksActiveTenantSchema
});

export type TasksTenantSummary = z.infer<typeof TasksTenantSummarySchema>;
export type TasksEntitlement = z.infer<typeof TasksEntitlementSchema>;
export type TasksContextSource = z.infer<typeof TasksContextSourceSchema>;
export type TasksActiveTenant = z.infer<typeof TasksActiveTenantSchema>;
export type TasksContextResponse = z.infer<typeof TasksContextResponseSchema>;
