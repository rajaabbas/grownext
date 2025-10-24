import { Buffer } from "node:buffer";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  SuperAdminUserListQuerySchema,
  SuperAdminUsersResponseSchema,
  SuperAdminUserDetailSchema,
  SuperAdminOrganizationRoleUpdateRequestSchema,
  SuperAdminTenantRoleUpdateRequestSchema,
  SuperAdminEntitlementGrantRequestSchema,
  SuperAdminEntitlementRevokeRequestSchema,
  SuperAdminUserStatusUpdateRequestSchema,
  SuperAdminImpersonationRequestSchema,
  SuperAdminBulkJobCreateRequestSchema,
  SuperAdminBulkJobUpdateRequestSchema,
  SuperAdminBulkJobSchema,
  SuperAdminBulkJobsResponseSchema,
  SuperAdminAuditLogQuerySchema,
  SuperAdminAuditLogResponseSchema,
  SuperAdminAuditExportResponseSchema,
  SuperAdminImpersonationResponseSchema,
  SuperAdminImpersonationCleanupResponseSchema,
  AdminBillingCatalogResponseSchema,
  AdminBillingPackageCreateRequestSchema,
  AdminBillingPackageUpdateRequestSchema,
  AdminBillingSubscriptionListResponseSchema,
  AdminBillingInvoiceListResponseSchema,
  AdminBillingUsageQuerySchema,
  AdminBillingUsageResponseSchema,
  AdminBillingInvoiceStatusUpdateRequestSchema,
  AdminBillingCreditIssueRequestSchema,
  AdminBillingCreditListResponseSchema,
  BillingPackageSchema,
  BillingInvoiceSchema,
  BillingCreditMemoSchema
} from "@ma/contracts";
import {
  getUserForSuperAdmin,
  listUsersForSuperAdmin,
  updateOrganizationMemberRole,
  updateTenantMemberRole,
  grantEntitlement,
  revokeEntitlement,
  recordAuditEvent,
  updateUserStatusForSuperAdmin,
  createImpersonationSessionForSuperAdmin,
  stopImpersonationSessionForSuperAdmin,
  cleanupExpiredImpersonationSessionsForSuperAdmin,
  listAuditLogsForSuperAdmin,
  createBulkJobForSuperAdmin,
  listBulkJobsForSuperAdmin,
  updateBulkJobForSuperAdmin,
  getBulkJobByIdForSuperAdmin,
  listBillingPackages,
  createBillingPackage,
  updateBillingPackage,
  listBillingUsageAggregates,
  createBillingCreditMemo,
  listBillingCreditMemosForOrganization,
  updateBillingInvoiceStatus,
  listBillingSubscriptions,
  listBillingInvoices,
  BillingCreditReason,
  type BillingSubscriptionStatus,
  type BillingInvoiceStatus,
  type OrganizationRole,
  type TenantRole,
  type ProductRole
} from "@ma/db";

const SUPER_ADMIN_ROLE = "super-admin";
const SUPPORT_ROLE = "support";
const AUDITOR_ROLE = "auditor";

const SUPER_ADMIN_EVENT_NAMES = {
  IMPERSONATION_STARTED: "super-admin.impersonation.started",
  IMPERSONATION_STOPPED: "super-admin.impersonation.stopped",
  BULK_JOB_QUEUED: "super-admin.bulk-job.queued",
  BULK_JOB_RETRIED: "super-admin.bulk-job.retried",
  BULK_JOB_PROGRESS: "super-admin.bulk-job.progress",
  BULK_JOB_COMPLETED: "super-admin.bulk-job.completed",
  BULK_JOB_FAILED: "super-admin.bulk-job.failed"
} as const;

const BILLING_SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED"
] as const satisfies readonly BillingSubscriptionStatus[];

const BILLING_INVOICE_STATUSES = [
  "DRAFT",
  "OPEN",
  "PAID",
  "VOID",
  "UNCOLLECTIBLE"
] as const satisfies readonly BillingInvoiceStatus[];

const getClaimsUserId = (claims: SupabaseJwtClaims | null | undefined): string | null => {
  if (!claims) {
    return null;
  }

  const rawUser = (claims as { user?: unknown }).user;
  if (!rawUser || typeof rawUser !== "object") {
    return null;
  }

  const userId = (rawUser as { id?: unknown }).id;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
};

const resolveRoleTokens = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => resolveRoleTokens(entry));
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
};

const collectRolesFromClaims = (claims: SupabaseJwtClaims | null): Set<string> => {
  const roles = new Set<string>();

  if (!claims) {
    return roles;
  }

  const addRole = (role: string) => {
    if (role.trim().length === 0) {
      return;
    }
    roles.add(role.toLowerCase());
  };

  resolveRoleTokens((claims as { roles?: unknown }).roles).forEach(addRole);
  resolveRoleTokens(claims.app_metadata?.roles).forEach(addRole);
  resolveRoleTokens(claims.user_metadata?.roles).forEach(addRole);

  if (claims.app_metadata && typeof claims.app_metadata === "object") {
    if ((claims.app_metadata as Record<string, unknown>)[SUPER_ADMIN_ROLE] === true) {
      addRole(SUPER_ADMIN_ROLE);
    }
    if ((claims.app_metadata as Record<string, unknown>)[SUPPORT_ROLE] === true) {
      addRole(SUPPORT_ROLE);
    }
    if ((claims.app_metadata as Record<string, unknown>)[AUDITOR_ROLE] === true) {
      addRole(AUDITOR_ROLE);
    }
  }

  if (claims.user_metadata && typeof claims.user_metadata === "object") {
    if ((claims.user_metadata as Record<string, unknown>)[SUPER_ADMIN_ROLE] === true) {
      addRole(SUPER_ADMIN_ROLE);
    }
    if ((claims.user_metadata as Record<string, unknown>)[SUPPORT_ROLE] === true) {
      addRole(SUPPORT_ROLE);
    }
    if ((claims.user_metadata as Record<string, unknown>)[AUDITOR_ROLE] === true) {
      addRole(AUDITOR_ROLE);
    }
  }

  return roles;
};

const requireRoles = (
  request: FastifyRequest,
  reply: FastifyReply,
  allowedRoles: string[]
): SupabaseJwtClaims => {
  const claims = request.supabaseClaims;

  if (!claims?.sub) {
    reply.status(401);
    throw new Error("not_authenticated");
  }

  const roles = collectRolesFromClaims(claims);
  const authorized = allowedRoles.some((role) => roles.has(role.toLowerCase()));

  if (!authorized) {
    reply.status(403);
    throw new Error("forbidden");
  }

  return claims;
};

const resolveImpersonationBaseUrl = (): string => {
  const base =
    process.env.SUPER_ADMIN_IMPERSONATION_BASE_URL ??
    process.env.ADMIN_APP_URL ??
    "https://admin.localhost";
  return base.replace(/\/$/, "");
};

const buildImpersonationUrl = (token: string): string =>
  `${resolveImpersonationBaseUrl()}/impersonate?token=${encodeURIComponent(token)}`;

const parseDate = (value?: string | null) => (value ? new Date(value) : undefined);

const buildAuditCsv = (events: { [key: string]: unknown }[]): string => {
  const headers = [
    "id",
    "eventType",
    "description",
    "organizationId",
    "tenantId",
    "productId",
    "actorEmail",
    "createdAt"
  ];

  const rows = events.map((event) => {
    const metadata = (event.metadata as Record<string, unknown> | null) ?? null;
    const actorEmail = metadata?.actorEmail ?? null;

    const values = [
      event.id,
      event.eventType,
      event.description ?? "",
      event.organizationId ?? "",
      event.tenantId ?? "",
      event.productId ?? "",
      actorEmail ?? "",
      event.createdAt
    ];

    return values
      .map((value) => {
        const stringValue = value === null || value === undefined ? "" : String(value);
        const escaped = stringValue.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
};

type SubscriptionRecord = Record<string, unknown> & {
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  trialEndsAt?: Date | string | null;
  canceledAt?: Date | string | null;
};

const serializeSubscriptionRecord = (subscription: SubscriptionRecord): Record<string, unknown> => ({
  ...subscription,
  currentPeriodStart:
    subscription.currentPeriodStart instanceof Date
      ? subscription.currentPeriodStart.toISOString()
      : subscription.currentPeriodStart,
  currentPeriodEnd:
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd.toISOString()
      : subscription.currentPeriodEnd,
  trialEndsAt:
    subscription.trialEndsAt instanceof Date
      ? subscription.trialEndsAt.toISOString()
      : subscription.trialEndsAt ?? null,
  canceledAt:
    subscription.canceledAt instanceof Date
      ? subscription.canceledAt.toISOString()
      : subscription.canceledAt ?? null
});

const superAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/users",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const query = SuperAdminUserListQuerySchema.parse(request.query ?? {});

      const result = await listUsersForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
        {
          search: query.search,
          page: query.page,
          pageSize: query.pageSize
        }
      );

      return SuperAdminUsersResponseSchema.parse({
        users: result.users,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage
        }
      });
    }
  );

  fastify.get(
    "/users/:userId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE, SUPPORT_ROLE]);

      const params = z.object({ userId: z.string().min(1) }).parse(request.params);
      const query = z.object({ verifiedEmail: z.string().optional() }).parse(request.query ?? {});
      const resolver = typeof query.verifiedEmail === "string" && query.verifiedEmail.length > 0 ? query.verifiedEmail : undefined;

      const user = await getUserForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
        params.userId,
        resolver
      );

      if (!user) {
        reply.status(404);
        return { error: "user_not_found" };
      }

      return SuperAdminUserDetailSchema.parse(user);
    }
  );

  fastify.patch(
    "/users/:userId/organizations/:organizationId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z
        .object({ userId: z.string().min(1), organizationId: z.string().min(1) })
        .parse(request.params);
      const body = SuperAdminOrganizationRoleUpdateRequestSchema.parse(request.body ?? {});

      try {
        const updated = await updateOrganizationMemberRole(buildServiceRoleClaims(params.organizationId), {
          organizationId: params.organizationId,
          userId: params.userId,
          role: body.role as OrganizationRole
        });

        if (!updated) {
          reply.status(404);
          return { error: "membership_not_found" };
        }

        await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
          eventType: "ADMIN_ACTION",
          actorUserId: request.supabaseClaims?.sub ?? null,
          organizationId: params.organizationId,
          description: `Super Admin updated organization role to ${body.role} for user ${params.userId}`
        });

        const refreshed = await getUserForSuperAdmin(
          buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
          params.userId
        );

        if (!refreshed) {
          reply.status(404);
          return { error: "user_not_found" };
        }

        return SuperAdminUserDetailSchema.parse(refreshed);
      } catch (error) {
        request.log.error({ error }, "Failed to update organization role");
        reply.status(500);
        return { error: "organization_role_update_failed" };
      }
    }
  );

  fastify.patch(
    "/users/:userId/organizations/:organizationId/tenants/:tenantId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z
        .object({
          userId: z.string().min(1),
          organizationId: z.string().min(1),
          tenantId: z.string().min(1)
        })
        .parse(request.params);
      const body = SuperAdminTenantRoleUpdateRequestSchema.parse(request.body ?? {});

      try {
        const updated = await updateTenantMemberRole(buildServiceRoleClaims(params.organizationId), {
          organizationId: params.organizationId,
          tenantId: params.tenantId,
          userId: params.userId,
          role: body.role as TenantRole
        });

        if (!updated) {
          reply.status(404);
          return { error: "tenant_membership_not_found" };
        }

        await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
          eventType: "ADMIN_ACTION",
          actorUserId: request.supabaseClaims?.sub ?? null,
          organizationId: params.organizationId,
          tenantId: params.tenantId,
          description: `Super Admin updated tenant role to ${body.role} for user ${params.userId}`
        });

        const refreshed = await getUserForSuperAdmin(
          buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
          params.userId
        );

        if (!refreshed) {
          reply.status(404);
          return { error: "user_not_found" };
        }

        return SuperAdminUserDetailSchema.parse(refreshed);
      } catch (error) {
        request.log.error({ error }, "Failed to update tenant role");
        reply.status(500);
        return { error: "tenant_role_update_failed" };
      }
    }
  );

  fastify.post(
    "/users/:userId/entitlements",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z.object({ userId: z.string().min(1) }).parse(request.params);
      const body = SuperAdminEntitlementGrantRequestSchema.parse(request.body ?? {});
      const serviceClaims = buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub });

      const beforeDetail = await getUserForSuperAdmin(serviceClaims, params.userId);
      const previousEntitlement = beforeDetail?.entitlements.find(
        (entitlement) =>
          entitlement.organizationId === body.organizationId &&
          entitlement.tenantId === body.tenantId &&
          entitlement.productId === body.productId
      );

      try {
        const entitlement = await grantEntitlement(buildServiceRoleClaims(body.organizationId), {
          organizationId: body.organizationId,
          tenantId: body.tenantId,
          productId: body.productId,
          userId: params.userId,
          roles: body.roles as ProductRole[],
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
        });

        await recordAuditEvent(buildServiceRoleClaims(body.organizationId), {
          eventType: "ENTITLEMENT_GRANTED",
          actorUserId: request.supabaseClaims?.sub ?? null,
          organizationId: body.organizationId,
          tenantId: body.tenantId,
          productId: body.productId,
          description: `Super Admin granted entitlement ${entitlement.id} for user ${params.userId}`,
          metadata: {
            before: previousEntitlement
              ? {
                  roles: previousEntitlement.roles,
                  expiresAt: previousEntitlement.expiresAt
                }
              : null,
            after: {
              roles: entitlement.roles,
              expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null
            },
            roles: entitlement.roles,
            expiresAt: entitlement.expiresAt?.toISOString() ?? null
          }
        });

        const refreshed = await getUserForSuperAdmin(
          buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
          params.userId
        );

        if (!refreshed) {
          reply.status(404);
          return { error: "user_not_found" };
        }

        return SuperAdminUserDetailSchema.parse(refreshed);
      } catch (error) {
        request.log.error({ error }, "Failed to grant entitlement");
        reply.status(500);
        return { error: "entitlement_grant_failed" };
      }
    }
  );

  fastify.delete(
    "/users/:userId/entitlements",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z.object({ userId: z.string().min(1) }).parse(request.params);
      const body = SuperAdminEntitlementRevokeRequestSchema.parse(request.body ?? {});
      const serviceClaims = buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub });

      const beforeDetail = await getUserForSuperAdmin(serviceClaims, params.userId);
      const revokedEntitlement = beforeDetail?.entitlements.find(
        (entitlement) =>
          entitlement.organizationId === body.organizationId &&
          entitlement.tenantId === body.tenantId &&
          entitlement.productId === body.productId
      );

      try {
        await revokeEntitlement(buildServiceRoleClaims(body.organizationId), {
          organizationId: body.organizationId,
          tenantId: body.tenantId,
          productId: body.productId,
          userId: params.userId
        });

        await recordAuditEvent(buildServiceRoleClaims(body.organizationId), {
          eventType: "ENTITLEMENT_REVOKED",
          actorUserId: request.supabaseClaims?.sub ?? null,
          organizationId: body.organizationId,
          tenantId: body.tenantId,
          productId: body.productId,
          description: `Super Admin revoked entitlement for user ${params.userId}`,
          metadata: {
            before: revokedEntitlement
              ? {
                  roles: revokedEntitlement.roles,
                  expiresAt: revokedEntitlement.expiresAt
                }
              : null,
            after: null
          }
        });

        const refreshed = await getUserForSuperAdmin(
          buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
          params.userId
        );

        if (!refreshed) {
          reply.status(404);
          return { error: "user_not_found" };
        }

        return SuperAdminUserDetailSchema.parse(refreshed);
      } catch (error) {
        request.log.error({ error }, "Failed to revoke entitlement");
        reply.status(500);
        return { error: "entitlement_revoke_failed" };
      }
    }
  );

  fastify.patch(
    "/users/:userId/status",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z.object({ userId: z.string().min(1) }).parse(request.params);
      const body = SuperAdminUserStatusUpdateRequestSchema.parse(request.body ?? {});

      await updateUserStatusForSuperAdmin(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        userId: params.userId,
        status: body.status
      });

      await recordAuditEvent(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        eventType: "ADMIN_ACTION",
        actorUserId: request.supabaseClaims?.sub ?? null,
        description: `Super Admin updated user status to ${body.status}`,
        metadata: {
          reason: body.reason ?? null,
          userId: params.userId
        }
      });

      const refreshed = await getUserForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
        params.userId
      );

      if (!refreshed) {
        reply.status(404);
        return { error: "user_not_found" };
      }

      return SuperAdminUserDetailSchema.parse(refreshed);
    }
  );

  fastify.post(
    "/users/:userId/impersonation",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z.object({ userId: z.string().min(1) }).parse(request.params);
      const body = SuperAdminImpersonationRequestSchema.parse(request.body ?? {});
      const expiresInMinutes = body.expiresInMinutes ?? 30;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      const actorId = request.supabaseClaims?.sub ?? getClaimsUserId(request.supabaseClaims) ?? null;

      const session = await createImpersonationSessionForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        {
          userId: params.userId,
          createdById: actorId ?? params.userId,
          reason: body.reason ?? null,
          productSlug: body.productSlug ?? null,
          expiresAt
        }
      );

      await recordAuditEvent(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        eventType: "IMPERSONATION_STARTED",
        actorUserId: actorId,
        description: `Super Admin started impersonation session for user ${params.userId}`,
        metadata: {
          reason: body.reason ?? null,
          productSlug: body.productSlug ?? null,
          expiresAt: session.expiresAt,
          impersonationTargetUserId: params.userId,
          initiatedBy: session.createdById
        }
      });

      await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.IMPERSONATION_STARTED, {
        tokenId: session.tokenId,
        userId: params.userId,
        initiatedBy: session.createdById,
        expiresAt: session.expiresAt,
        reason: body.reason ?? null,
        productSlug: body.productSlug ?? null
      });

      return SuperAdminImpersonationResponseSchema.parse({
        tokenId: session.tokenId,
        url: buildImpersonationUrl(session.token),
        expiresAt: session.expiresAt,
        createdAt: session.createdAt
      });
    }
  );

  fastify.delete(
    "/users/:userId/impersonation/:tokenId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const params = z.object({ userId: z.string().min(1), tokenId: z.string().min(1) }).parse(request.params);
      const actorId = request.supabaseClaims?.sub ?? getClaimsUserId(request.supabaseClaims) ?? null;

      const session = await stopImpersonationSessionForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        params.tokenId
      );

      if (!session || session.userId !== params.userId) {
        reply.status(404);
        return { error: "impersonation_session_not_found" };
      }

      await recordAuditEvent(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        eventType: "IMPERSONATION_STOPPED",
        actorUserId: actorId,
        description: `Super Admin stopped impersonation session for user ${params.userId}`,
        metadata: {
          impersonationTargetUserId: params.userId,
          initiatedBy: session.createdById,
          stoppedBy: actorId,
          stoppedAt: new Date().toISOString()
        }
      });

      await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.IMPERSONATION_STOPPED, {
        tokenId: session.tokenId,
        userId: params.userId,
        stoppedBy: actorId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });

      reply.status(204);
      return null;
    }
  );

  fastify.post(
    "/impersonation/cleanup",
    async (request, reply) => {
      if (request.supabaseClaims?.role !== "service_role") {
        reply.status(403);
        return { error: "forbidden" };
      }

      const expiredSessions = await cleanupExpiredImpersonationSessionsForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role" })
      );

      if (expiredSessions.length > 0) {
        for (const session of expiredSessions) {
          await recordAuditEvent(buildServiceRoleClaims(undefined, { role: "service_role" }), {
            eventType: "IMPERSONATION_STOPPED",
            actorUserId: null,
            description: `Impersonation session ${session.tokenId} expired for user ${session.userId}`,
            metadata: {
              impersonationTargetUserId: session.userId,
              initiatedBy: session.createdById,
              stoppedBy: null,
              stoppedAt: new Date().toISOString(),
              reason: "expired",
              productSlug: session.productSlug ?? null
            }
          });

          await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.IMPERSONATION_STOPPED, {
            tokenId: session.tokenId,
            userId: session.userId,
            stoppedBy: null,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            reason: "expired"
          });
        }
      }

      return SuperAdminImpersonationCleanupResponseSchema.parse({
        removed: expiredSessions.length,
        sessions: expiredSessions
      });
    }
  );

  fastify.get(
    "/bulk-jobs",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const jobs = await listBulkJobsForSuperAdmin(buildServiceRoleClaims(undefined, { role: "service_role" }));

      return SuperAdminBulkJobsResponseSchema.parse({ jobs });
    }
  );

  fastify.post(
    "/bulk-jobs",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

      const body = SuperAdminBulkJobCreateRequestSchema.parse(request.body ?? {});

      const initiatedById = request.supabaseClaims?.sub ?? getClaimsUserId(request.supabaseClaims);
      if (!initiatedById) {
        reply.status(401);
        return { error: "not_authenticated" };
      }

      const job = await createBulkJobForSuperAdmin(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        action: body.action,
        userIds: body.userIds,
        reason: body.reason ?? null,
        initiatedById
      });

      await recordAuditEvent(buildServiceRoleClaims(undefined, { role: "service_role" }), {
        eventType: "BULK_JOB_QUEUED",
        actorUserId: initiatedById,
        description: `Super Admin queued bulk job ${job.id}`,
        metadata: {
          action: job.action,
          totalCount: job.totalCount
        }
      });

      await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_QUEUED, {
        jobId: job.id,
        action: job.action,
        totalCount: job.totalCount,
        initiatedBy: job.initiatedBy.id,
        createdAt: job.createdAt
      });

      await fastify.queues.broadcastSuperAdminBulkJobStatus({
        jobId: job.id,
        status: job.status,
        totalCount: job.totalCount,
        completedCount: job.completedCount,
        failedCount: job.failedCount,
        progressMessage: job.progressMessage,
        progressUpdatedAt: job.progressUpdatedAt,
        failureCount: job.failureDetails.length,
        resultUrl: job.resultUrl,
        resultExpiresAt: job.resultExpiresAt
      });

      if (job.totalCount > 0 && job.status !== "SUCCEEDED") {
        await fastify.queues.emitSuperAdminBulkJob({
          jobId: job.id,
          action: job.action,
          userIds: body.userIds,
          reason: job.reason,
          initiatedById,
          initiatedByEmail: job.initiatedBy.email,
          requestedAt: job.createdAt,
          context: "initial"
        });
      } else if (job.status === "SUCCEEDED") {
        await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_COMPLETED, {
          jobId: job.id,
          action: job.action,
          totalCount: job.totalCount,
          completedCount: job.completedCount,
          failedCount: job.failedCount,
          initiatedBy: job.initiatedBy.id
        });
      }

      return SuperAdminBulkJobSchema.parse(job);
    }
  );

  fastify.patch(
    "/bulk-jobs/:jobId",
    async (request, reply) => {
      const isServiceCall = request.supabaseClaims?.role === "service_role";
      if (!isServiceCall) {
        requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
      }

      const params = z.object({ jobId: z.string().min(1) }).parse(request.params);
      const body = SuperAdminBulkJobUpdateRequestSchema.parse(request.body ?? {});

      const serviceClaims = buildServiceRoleClaims(undefined, { role: "service_role" });
      const existing = await getBulkJobByIdForSuperAdmin(serviceClaims, params.jobId);

      if (!existing) {
        reply.status(404);
        return { error: "bulk_job_not_found" };
      }

      const actorId = request.supabaseClaims?.sub ?? getClaimsUserId(request.supabaseClaims) ?? null;
      const previousStatus = existing.status;

      let updated = null;

      if (body.action === "retry") {
        const progressMessage = body.progressMessage ?? "Retry requested";
        updated = await updateBulkJobForSuperAdmin(serviceClaims, {
          jobId: params.jobId,
          status: "PENDING",
          completedCount: 0,
          failedCount: 0,
          errorMessage: null,
          progressMessage,
          failureDetails: [],
          resultUrl: null,
          resultExpiresAt: null
        });

        if (!updated) {
          reply.status(404);
          return { error: "bulk_job_not_found" };
        }

        await fastify.queues.emitSuperAdminBulkJob({
          jobId: updated.id,
          action: updated.action,
          userIds: existing.userIds,
          reason: updated.reason,
          initiatedById: existing.initiatedBy.id,
          initiatedByEmail: existing.initiatedBy.email,
          requestedAt: new Date().toISOString(),
          context: "retry"
        });

        await recordAuditEvent(serviceClaims, {
          eventType: "BULK_JOB_RETRIED",
          actorUserId: actorId,
          description: `Super Admin retried bulk job ${updated.id}`,
          metadata: {
            jobId: updated.id,
            action: updated.action
          }
        });

        await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_RETRIED, {
          jobId: updated.id,
          action: updated.action,
          initiatedBy: updated.initiatedBy.id
        });
      } else if (body.action === "cancel") {
        const errorMessage = body.errorMessage ?? "Bulk job cancelled by administrator.";
        const progressMessage = body.progressMessage ?? "Cancelled by administrator";
        updated = await updateBulkJobForSuperAdmin(serviceClaims, {
          jobId: params.jobId,
          status: "FAILED",
          errorMessage,
          progressMessage,
          resultUrl: null,
          resultExpiresAt: null
        });

        if (!updated) {
          reply.status(404);
          return { error: "bulk_job_not_found" };
        }

        await recordAuditEvent(serviceClaims, {
          eventType: "BULK_JOB_CANCELLED",
          actorUserId: actorId,
          description: `Super Admin cancelled bulk job ${updated.id}`,
          metadata: {
            jobId: updated.id,
            reason: errorMessage
          }
        });

        await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_FAILED, {
          jobId: updated.id,
          action: updated.action,
          completedCount: updated.completedCount,
          failedCount: updated.failedCount,
          initiatedBy: updated.initiatedBy.id,
          errorMessage
        });
      } else {
        updated = await updateBulkJobForSuperAdmin(serviceClaims, {
          jobId: params.jobId,
          status: body.status,
          completedCount: body.completedCount,
          failedCount: body.failedCount,
          errorMessage: body.errorMessage ?? undefined,
          progressMessage: body.progressMessage ?? undefined,
          progressUpdatedAt: body.progressUpdatedAt ?? undefined,
          failureDetails: body.failureDetails ?? undefined,
          resultUrl: body.resultUrl ?? undefined,
          resultExpiresAt: body.resultExpiresAt ?? undefined
        });

        if (!updated) {
          reply.status(404);
          return { error: "bulk_job_not_found" };
        }
      }

      const nextStatus = updated.status;

      await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_PROGRESS, {
        jobId: updated.id,
        action: updated.action,
        status: updated.status,
        completedCount: updated.completedCount,
        failedCount: updated.failedCount,
        progressMessage: updated.progressMessage,
        progressUpdatedAt: updated.progressUpdatedAt,
        failureCount: updated.failureDetails.length
      });

      await fastify.queues.broadcastSuperAdminBulkJobStatus({
        jobId: updated.id,
        status: updated.status,
        totalCount: existing.totalCount,
        completedCount: updated.completedCount,
        failedCount: updated.failedCount,
        progressMessage: updated.progressMessage,
        progressUpdatedAt: updated.progressUpdatedAt,
        failureCount: updated.failureDetails.length,
        resultUrl: updated.resultUrl,
        resultExpiresAt: updated.resultExpiresAt
      });

      if (nextStatus !== previousStatus) {
        if (nextStatus === "SUCCEEDED") {
          await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_COMPLETED, {
            jobId: updated.id,
            action: updated.action,
            completedCount: updated.completedCount,
            failedCount: updated.failedCount,
            initiatedBy: updated.initiatedBy.id,
            resultUrl: updated.resultUrl,
            resultExpiresAt: updated.resultExpiresAt
          });

          await recordAuditEvent(serviceClaims, {
            eventType: "BULK_JOB_SUCCEEDED",
            actorUserId: actorId,
            description: `Bulk job ${updated.id} completed successfully`,
            metadata: {
              jobId: updated.id,
              action: updated.action,
              completedCount: updated.completedCount,
              failedCount: updated.failedCount,
              resultUrl: updated.resultUrl ?? null,
              resultExpiresAt: updated.resultExpiresAt ?? null
            }
          });
        } else if (nextStatus === "FAILED") {
          await fastify.queues.emitIdentityEvent(SUPER_ADMIN_EVENT_NAMES.BULK_JOB_FAILED, {
            jobId: updated.id,
            action: updated.action,
            completedCount: updated.completedCount,
            failedCount: updated.failedCount,
            initiatedBy: updated.initiatedBy.id,
            errorMessage: updated.errorMessage
          });

          await recordAuditEvent(serviceClaims, {
            eventType: "BULK_JOB_FAILED",
            actorUserId: actorId,
            description: `Bulk job ${updated.id} failed`,
            metadata: {
              jobId: updated.id,
              action: updated.action,
              completedCount: updated.completedCount,
              failedCount: updated.failedCount,
              errorMessage: updated.errorMessage ?? null
            }
          });
        }
      }

      return SuperAdminBulkJobSchema.parse(updated);
    }
  );

  fastify.get("/billing/packages", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);

    const packages = await listBillingPackages(buildServiceRoleClaims(undefined, { role: "service_role" }), {
      includeInactive: true
    });

    reply.header("Cache-Control", "no-store");
    return AdminBillingCatalogResponseSchema.parse({ packages });
  });

  fastify.post("/billing/packages", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const body = AdminBillingPackageCreateRequestSchema.parse(request.body ?? {});

    const created = await createBillingPackage(buildServiceRoleClaims(undefined, { role: "service_role" }), body);

    reply.code(201);
    return BillingPackageSchema.parse(created);
  });

  fastify.patch<{ Params: { packageId: string }; Body: unknown }>(
    "/billing/packages/:packageId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
      const params = z.object({ packageId: z.string().min(1) }).parse(request.params);
      const body = AdminBillingPackageUpdateRequestSchema.parse(request.body ?? {});

      const updated = await updateBillingPackage(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        params.packageId,
        body
      );

      return BillingPackageSchema.parse(updated);
    }
  );

  fastify.get("/billing/subscriptions", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const query = z
      .object({
        organizationId: z.string().optional(),
        status: z.enum(BILLING_SUBSCRIPTION_STATUSES).optional()
      })
      .parse(request.query ?? {});

    const organizationId = query.organizationId?.trim() ? query.organizationId.trim() : undefined;
    const serviceClaims = buildServiceRoleClaims(organizationId);
    const subscriptions = await listBillingSubscriptions(serviceClaims, {
      organizationId,
      status: query.status
    });

    reply.header("Cache-Control", "no-store");
    return AdminBillingSubscriptionListResponseSchema.parse({
      subscriptions: subscriptions.map((subscription) => serializeSubscriptionRecord(subscription))
    });
  });

  fastify.get("/billing/invoices", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const query = z
      .object({
        organizationId: z.string().optional(),
        status: z.enum(BILLING_INVOICE_STATUSES).optional()
      })
      .parse(request.query ?? {});

    const organizationId = query.organizationId?.trim() ? query.organizationId.trim() : undefined;
    const serviceClaims = buildServiceRoleClaims(organizationId);
    const invoices = await listBillingInvoices(serviceClaims, {
      organizationId,
      status: query.status,
      includeLines: true
    });

    reply.header("Cache-Control", "no-store");
    return AdminBillingInvoiceListResponseSchema.parse({
      invoices: invoices.map((invoice) => ({
        ...invoice,
        issuedAt: invoice.issuedAt.toISOString(),
        dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        voidedAt: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
        lines: invoice.lines?.map((line) => ({
          ...line,
          quantity: line.quantity.toString(),
          usagePeriodStart: line.usagePeriodStart ? line.usagePeriodStart.toISOString() : null,
          usagePeriodEnd: line.usagePeriodEnd ? line.usagePeriodEnd.toISOString() : null
        }))
      }))
    });
  });

  fastify.patch<{ Params: { invoiceId: string }; Body: unknown }>(
    "/billing/invoices/:invoiceId",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
      const params = z.object({ invoiceId: z.string().min(1) }).parse(request.params);
      const body = AdminBillingInvoiceStatusUpdateRequestSchema.parse(request.body ?? {});

      const updated = await updateBillingInvoiceStatus(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        params.invoiceId,
        body.status,
        {
          paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
          voidedAt: body.voidedAt ? new Date(body.voidedAt) : undefined,
          balanceCents: body.balanceCents ?? undefined,
          metadata: body.metadata ?? undefined
        }
      );

      return BillingInvoiceSchema.parse({
        ...updated,
        issuedAt: updated.issuedAt.toISOString(),
        dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
        paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
        voidedAt: updated.voidedAt ? updated.voidedAt.toISOString() : null
      });
    }
  );

  fastify.get("/billing/usage", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const query = AdminBillingUsageQuerySchema.parse(request.query ?? {});

    if (!query.organizationId) {
      reply.status(400);
      return { error: "organizationId_required" };
    }

    const serviceClaims = buildServiceRoleClaims(query.organizationId);
    const aggregates = await listBillingUsageAggregates(serviceClaims, query.organizationId, {
      featureKey: query.featureKey,
      resolution: query.resolution,
      periodStart: query.from ? new Date(query.from) : undefined,
      periodEnd: query.to ? new Date(query.to) : undefined,
      limit: 200
    });

    const grouped = new Map<
      string,
      {
        featureKey: string;
        unit: string;
        resolution: string;
        points: Array<{ periodStart: string; periodEnd: string; quantity: string; unit: string; source: string }>;
      }
    >();

    for (const aggregate of aggregates) {
      const key = `${aggregate.featureKey}:${aggregate.unit}:${aggregate.resolution}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          featureKey: aggregate.featureKey,
          unit: aggregate.unit,
          resolution: aggregate.resolution,
          points: []
        });
      }
      grouped.get(key)!.points.push({
        periodStart: aggregate.periodStart.toISOString(),
        periodEnd: aggregate.periodEnd.toISOString(),
        quantity: aggregate.quantity.toString(),
        unit: aggregate.unit,
        source: aggregate.source
      });
    }

    const series = Array.from(grouped.values());
    const summaries = series.map((entry) => {
      const total = entry.points.reduce((sum, point) => sum + Number(point.quantity), 0);
      return {
        featureKey: entry.featureKey,
        resolution: entry.resolution,
        totalQuantity: total.toString(),
        unit: entry.unit,
        periodStart: entry.points.at(-1)?.periodStart ?? new Date().toISOString(),
        periodEnd: entry.points[0]?.periodEnd ?? new Date().toISOString(),
        limitType: null,
        limitValue: null,
        limitUnit: null,
        usagePeriod: null,
        percentageUsed: null
      };
    });

    reply.header("Cache-Control", "no-store");
    return AdminBillingUsageResponseSchema.parse({ series, summaries });
  });

  fastify.post("/billing/credits", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const query = z.object({ organizationId: z.string().min(1) }).parse(request.query ?? {});
    const body = AdminBillingCreditIssueRequestSchema.parse(request.body ?? {});

    const normalizedReason = body.reason?.toUpperCase() ?? "OTHER";
    const reasonMap = BillingCreditReason as unknown as Record<string, BillingCreditReason>;
    const reasonValue = reasonMap[normalizedReason] ?? BillingCreditReason.OTHER;

    const created = await createBillingCreditMemo(buildServiceRoleClaims(query.organizationId), {
      organizationId: query.organizationId,
      invoiceId: body.invoiceId ?? null,
      amountCents: body.amountCents,
      currency: body.currency ?? "usd",
      reason: reasonValue,
      metadata: body.metadata ?? null
    });

    reply.code(201);
    return BillingCreditMemoSchema.parse(created);
  });

  fastify.get("/billing/credits", async (request, reply) => {
    requireRoles(request, reply, [SUPER_ADMIN_ROLE]);
    const query = z.object({ organizationId: z.string().min(1) }).parse(request.query ?? {});

    const credits = await listBillingCreditMemosForOrganization(
      buildServiceRoleClaims(query.organizationId),
      query.organizationId
    );

    reply.header("Cache-Control", "no-store");
    return AdminBillingCreditListResponseSchema.parse({ credits });
  });

  fastify.get(
    "/audit/logs",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE, SUPPORT_ROLE, AUDITOR_ROLE]);

      const rawQuery = SuperAdminAuditLogQuerySchema.partial().parse(request.query ?? {});

      const result = await listAuditLogsForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        {
          search: rawQuery.search,
          actorEmail: rawQuery.actorEmail,
          eventType: rawQuery.eventType,
          start: parseDate(rawQuery.start ?? null),
          end: parseDate(rawQuery.end ?? null),
          page: rawQuery.page,
          pageSize: rawQuery.pageSize
        }
      );

      return SuperAdminAuditLogResponseSchema.parse(result);
    }
  );

  fastify.post(
    "/audit/export",
    async (request, reply) => {
      requireRoles(request, reply, [SUPER_ADMIN_ROLE, AUDITOR_ROLE]);

      const rawBody = SuperAdminAuditLogQuerySchema.partial().parse(request.body ?? {});

      const result = await listAuditLogsForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role" }),
        {
          search: rawBody.search,
          actorEmail: rawBody.actorEmail,
          eventType: rawBody.eventType,
          start: parseDate(rawBody.start ?? null),
          end: parseDate(rawBody.end ?? null),
          page: 1,
          pageSize: Math.min(rawBody.pageSize ?? 500, 1000)
        }
      );

      const csv = buildAuditCsv(result.events as unknown as Record<string, unknown>[]);
      const base64 = Buffer.from(csv, "utf8").toString("base64");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      return SuperAdminAuditExportResponseSchema.parse({
        url: `data:text/csv;base64,${base64}`,
        expiresAt
      });
    }
  );
};

export default superAdminRoutes;
