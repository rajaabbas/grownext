import { z } from "zod";
import { OrganizationRoleSchema } from "./organization";

export const SuperAdminRoleSchema = z.enum(["SUPER_ADMIN", "SUPPORT", "AUDITOR"]);
export type SuperAdminRole = z.infer<typeof SuperAdminRoleSchema>;

export const SuperAdminUserStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"]);
export type SuperAdminUserStatus = z.infer<typeof SuperAdminUserStatusSchema>;

export const SuperAdminTenantRoleSchema = z.enum(["ADMIN", "MEMBER"]);
export type SuperAdminTenantRole = z.infer<typeof SuperAdminTenantRoleSchema>;

export const SuperAdminProductRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "ANALYST",
  "CONTRIBUTOR",
  "MEMBER"
]);
export type SuperAdminProductRole = z.infer<typeof SuperAdminProductRoleSchema>;

export const SuperAdminUserListQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  status: SuperAdminUserStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type SuperAdminUserListQuery = z.infer<typeof SuperAdminUserListQuerySchema>;

export const SuperAdminOrganizationSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  role: OrganizationRoleSchema
});
export type SuperAdminOrganizationSummary = z.infer<typeof SuperAdminOrganizationSummarySchema>;

export const SuperAdminUserSummarySchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().nullable(),
  status: SuperAdminUserStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string().nullable(),
  organizations: z.array(SuperAdminOrganizationSummarySchema),
  tenantCount: z.number().int().nonnegative(),
  productSlugs: z.array(z.string().min(1)),
  productCount: z.number().int().nonnegative()
});
export type SuperAdminUserSummary = z.infer<typeof SuperAdminUserSummarySchema>;

export const SuperAdminUsersResponseSchema = z.object({
  users: z.array(SuperAdminUserSummarySchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
  })
});
export type SuperAdminUsersResponse = z.infer<typeof SuperAdminUsersResponseSchema>;

export const SuperAdminTenantMembershipSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  role: SuperAdminTenantRoleSchema
});
export type SuperAdminTenantMembership = z.infer<typeof SuperAdminTenantMembershipSchema>;

export const SuperAdminOrganizationDetailSchema = SuperAdminOrganizationSummarySchema.extend({
  tenants: z.array(SuperAdminTenantMembershipSchema)
});
export type SuperAdminOrganizationDetail = z.infer<typeof SuperAdminOrganizationDetailSchema>;

export const SuperAdminEntitlementSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantName: z.string().nullable(),
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  productName: z.string().min(1),
  roles: z.array(SuperAdminProductRoleSchema),
  expiresAt: z.string().nullable(),
  createdAt: z.string()
});
export type SuperAdminEntitlement = z.infer<typeof SuperAdminEntitlementSchema>;

export const SuperAdminEntitlementGrantRequestSchema = z.object({
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  roles: z.array(SuperAdminProductRoleSchema).default(["MEMBER"]),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional()
});
export type SuperAdminEntitlementGrantRequest = z.infer<
  typeof SuperAdminEntitlementGrantRequestSchema
>;

export const SuperAdminEntitlementRevokeRequestSchema = z.object({
  organizationId: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1)
});
export type SuperAdminEntitlementRevokeRequest = z.infer<
  typeof SuperAdminEntitlementRevokeRequestSchema
>;

export const SuperAdminAuditEventSchema = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  description: z.string().nullable(),
  organizationId: z.string().nullable(),
  tenantId: z.string().nullable(),
  productId: z.string().nullable(),
  actorEmail: z.string().email().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string()
});
export type SuperAdminAuditEvent = z.infer<typeof SuperAdminAuditEventSchema>;

export const SuperAdminSamlAccountSchema = z.object({
  id: z.string().min(1),
  samlConnectionId: z.string().min(1),
  samlConnectionLabel: z.string().min(1),
  nameId: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string()
});
export type SuperAdminSamlAccount = z.infer<typeof SuperAdminSamlAccountSchema>;

export const SuperAdminUserDetailSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().nullable(),
  status: SuperAdminUserStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string().nullable(),
  organizations: z.array(SuperAdminOrganizationDetailSchema),
  entitlements: z.array(SuperAdminEntitlementSchema),
  auditEvents: z.array(SuperAdminAuditEventSchema),
  samlAccounts: z.array(SuperAdminSamlAccountSchema)
});
export type SuperAdminUserDetail = z.infer<typeof SuperAdminUserDetailSchema>;

export const SuperAdminOrganizationRoleUpdateRequestSchema = z.object({
  role: OrganizationRoleSchema
});
export type SuperAdminOrganizationRoleUpdateRequest = z.infer<
  typeof SuperAdminOrganizationRoleUpdateRequestSchema
>;

export const SuperAdminTenantRoleUpdateRequestSchema = z.object({
  role: SuperAdminTenantRoleSchema
});
export type SuperAdminTenantRoleUpdateRequest = z.infer<typeof SuperAdminTenantRoleUpdateRequestSchema>;

export const SuperAdminUserStatusUpdateRequestSchema = z.object({
  status: SuperAdminUserStatusSchema,
  reason: z.string().min(1).max(500).optional()
});
export type SuperAdminUserStatusUpdateRequest = z.infer<typeof SuperAdminUserStatusUpdateRequestSchema>;

export const SuperAdminImpersonationRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  productSlug: z.string().min(1).optional()
});
export type SuperAdminImpersonationRequest = z.infer<typeof SuperAdminImpersonationRequestSchema>;

export const SuperAdminImpersonationResponseSchema = z.object({
  tokenId: z.string().min(1),
  url: z.string().url(),
  expiresAt: z.string(),
  createdAt: z.string()
});
export type SuperAdminImpersonationResponse = z.infer<typeof SuperAdminImpersonationResponseSchema>;

export const SuperAdminImpersonationCleanupResponseSchema = z.object({
  removed: z.number().int().nonnegative(),
  sessions: z
    .array(
      z.object({
        tokenId: z.string().min(1),
        userId: z.string().min(1),
        createdById: z.string().min(1),
        expiresAt: z.string(),
        createdAt: z.string(),
        reason: z.string().nullable(),
        productSlug: z.string().nullable()
      })
    )
    .default([])
});
export type SuperAdminImpersonationCleanupResponse = z.infer<typeof SuperAdminImpersonationCleanupResponseSchema>;

export const SuperAdminBulkActionSchema = z.enum([
  "ACTIVATE_USERS",
  "SUSPEND_USERS",
  "EXPORT_USERS"
]);
export type SuperAdminBulkAction = z.infer<typeof SuperAdminBulkActionSchema>;

export const SuperAdminBulkJobCreateRequestSchema = z.object({
  action: SuperAdminBulkActionSchema,
  userIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1).max(500).optional()
});
export type SuperAdminBulkJobCreateRequest = z.infer<typeof SuperAdminBulkJobCreateRequestSchema>;

export const SuperAdminBulkJobFailureSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().nullable().optional(),
  reason: z.string().nullable()
});
export type SuperAdminBulkJobFailure = z.infer<typeof SuperAdminBulkJobFailureSchema>;

export const SuperAdminBulkJobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED"
]);
export type SuperAdminBulkJobStatus = z.infer<typeof SuperAdminBulkJobStatusSchema>;

export const SuperAdminBulkJobSchema = z.object({
  id: z.string().min(1),
  action: SuperAdminBulkActionSchema,
  status: SuperAdminBulkJobStatusSchema,
  totalCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  initiatedBy: z.object({
    id: z.string().min(1),
    email: z.string().email()
  }),
  errorMessage: z.string().nullable(),
  reason: z.string().nullable().optional().default(null),
  progressMessage: z.string().nullable().optional().default(null),
  progressUpdatedAt: z.string().nullable().optional().default(null),
  failureDetails: z.array(SuperAdminBulkJobFailureSchema).optional().default([]),
  resultUrl: z.string().url().nullable().optional().default(null),
  resultExpiresAt: z.string().nullable().optional().default(null)
});
export type SuperAdminBulkJob = z.infer<typeof SuperAdminBulkJobSchema>;

export const SuperAdminBulkJobsResponseSchema = z.object({
  jobs: z.array(SuperAdminBulkJobSchema)
});
export type SuperAdminBulkJobsResponse = z.infer<typeof SuperAdminBulkJobsResponseSchema>;

export const SuperAdminBulkJobUpdateRequestSchema = z
  .object({
    status: SuperAdminBulkJobStatusSchema.optional(),
    completedCount: z.number().int().nonnegative().optional(),
    failedCount: z.number().int().nonnegative().optional(),
    errorMessage: z.string().nullable().optional(),
    progressMessage: z.string().min(1).max(200).nullable().optional(),
    progressUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
    failureDetails: z.array(SuperAdminBulkJobFailureSchema).optional(),
    resultUrl: z.string().url().nullable().optional(),
    resultExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    action: z.enum(["retry", "cancel"]).optional()
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.completedCount !== undefined ||
      value.failedCount !== undefined ||
      value.errorMessage !== undefined ||
      value.progressMessage !== undefined ||
      value.progressUpdatedAt !== undefined ||
      value.failureDetails !== undefined ||
      value.resultUrl !== undefined ||
      value.resultExpiresAt !== undefined ||
      value.action !== undefined,
    {
      message: "At least one field must be provided"
    }
  );
export type SuperAdminBulkJobUpdateRequest = z.infer<typeof SuperAdminBulkJobUpdateRequestSchema>;

export const SuperAdminAuditLogQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  actorEmail: z.string().email().optional(),
  eventType: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional()
});
export type SuperAdminAuditLogQuery = z.infer<typeof SuperAdminAuditLogQuerySchema>;

export const SuperAdminAuditLogResponseSchema = z.object({
  events: z.array(SuperAdminAuditEventSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
  })
});
export type SuperAdminAuditLogResponse = z.infer<typeof SuperAdminAuditLogResponseSchema>;

export const SuperAdminAuditExportResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string()
});
export type SuperAdminAuditExportResponse = z.infer<typeof SuperAdminAuditExportResponseSchema>;
