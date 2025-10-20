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

export const TasksUserStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"]);

export const TasksNotificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["bulk-job"]),
  title: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.string().min(1),
  actionUrl: z.string().min(1).nullable(),
  meta: z.record(z.any()).nullable()
});

export const TasksContextSourceSchema = z.enum(["request", "metadata", "fallback"]);

export const TasksActiveTenantSchema = z.object({
  entitlementId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantName: z.string().nullable(),
  roles: z.array(z.string().min(1)),
  source: TasksContextSourceSchema
});

export const TasksProjectSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TasksProjectSummaryScopeSchema = z.enum(["all", "project", "unassigned"]);

export const TasksProjectSummarySchema = z.object({
  projectId: z.string().min(1).nullable(),
  name: z.string().min(1),
  openCount: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  scope: TasksProjectSummaryScopeSchema
});

export const TasksPermissionSummarySchema = z.object({
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canComment: z.boolean(),
  canAssign: z.boolean(),
  canManage: z.boolean()
});

export const TasksPermissionPolicySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  userId: z.string().min(1),
  canManage: z.boolean(),
  canEdit: z.boolean(),
  canComment: z.boolean(),
  canAssign: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TasksContextResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    fullName: z.string().nullable(),
    status: TasksUserStatusSchema.default("ACTIVE")
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
  activeTenant: TasksActiveTenantSchema,
  projects: z.array(TasksProjectSchema),
  projectSummaries: z.array(TasksProjectSummarySchema),
  permissions: z.object({
    roles: z.array(z.string().min(1)),
    effective: TasksPermissionSummarySchema
  }),
  notifications: z.array(TasksNotificationSchema).default([])
});

export const TasksUserSummarySchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable(),
  fullName: z.string().nullable()
});

export const TasksUsersResponseSchema = z.object({
  users: z.array(TasksUserSummarySchema)
});

export type TasksTenantSummary = z.infer<typeof TasksTenantSummarySchema>;
export type TasksEntitlement = z.infer<typeof TasksEntitlementSchema>;
export type TasksUserStatus = z.infer<typeof TasksUserStatusSchema>;
export type TasksContextSource = z.infer<typeof TasksContextSourceSchema>;
export type TasksActiveTenant = z.infer<typeof TasksActiveTenantSchema>;
export type TasksProject = z.infer<typeof TasksProjectSchema>;
export type TasksProjectSummaryScope = z.infer<typeof TasksProjectSummaryScopeSchema>;
export type TasksProjectSummary = z.infer<typeof TasksProjectSummarySchema>;
export type TasksPermissionSummary = z.infer<typeof TasksPermissionSummarySchema>;
export type TasksPermissionPolicy = z.infer<typeof TasksPermissionPolicySchema>;
export type TasksContextResponse = z.infer<typeof TasksContextResponseSchema>;
export type TasksNotification = z.infer<typeof TasksNotificationSchema>;
export type TasksUserSummary = z.infer<typeof TasksUserSummarySchema>;
export type TasksUsersResponse = z.infer<typeof TasksUsersResponseSchema>;
