import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  getOrganizationById,
  listEntitlementsForOrganization,
  listEntitlementsForTenant,
  listEntitlementsForUser,
  listTenantSummariesForOrganization,
  listTenantMembershipsForUser,
  withAuthorizationTransaction,
  getUserProfile,
  listRecentBulkJobsImpactingUser
} from "@ma/db";
import { TasksContextResponseSchema, TasksUsersResponseSchema } from "@ma/contracts";
import {
  buildTaskPermissionEvaluator,
  listPermissionPoliciesForUser,
  listProjectSummariesForTenant,
  listProjectsForTenant
} from "@ma/tasks-db";

const querySchema = z.object({
  productSlug: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional()
});

const usersQuerySchema = z.object({
  userId: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
  productSlug: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional()
});

const DEFAULT_PRODUCT_SLUG = process.env.TASKS_PRODUCT_SLUG ?? "tasks";

const resolveOrganizationId = async (claims: SupabaseJwtClaims | null): Promise<string | null> => {
  if (!claims) {
    return null;
  }

  const direct = claims.organization_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const appMetadataOrg =
    claims.app_metadata && (claims.app_metadata as Record<string, unknown>).organization_id;
  if (typeof appMetadataOrg === "string" && appMetadataOrg.length > 0) {
    return appMetadataOrg;
  }

  const userMetadataOrg =
    claims.user_metadata && (claims.user_metadata as Record<string, unknown>).organization_id;
  if (typeof userMetadataOrg === "string" && userMetadataOrg.length > 0) {
    return userMetadataOrg;
  }

  if (!claims.sub) {
    return null;
  }

  const membership = await withAuthorizationTransaction(
    buildServiceRoleClaims(undefined),
    (tx) =>
      tx.organizationMember.findFirst({
        where: { userId: claims.sub },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" }
      })
  );

  return membership?.organizationId ?? null;
};

const resolveFullName = (claims: SupabaseJwtClaims | null): string | null => {
  if (!claims) return null;

  const metadata = claims.user_metadata ?? {};
  const appMetadata = claims.app_metadata ?? {};
  const fullName =
    (metadata as Record<string, unknown>).full_name ??
    (appMetadata as Record<string, unknown>).full_name;

  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName.trim();
  }

  return null;
};

const resolvePreferredTenantId = (claims: SupabaseJwtClaims | null): string | null => {
  if (!claims) return null;

  const metadata = claims.user_metadata ?? {};
  const appMetadata = claims.app_metadata ?? {};

  const tenantId =
    (metadata as Record<string, unknown>).tenant_id ??
    (appMetadata as Record<string, unknown>).tenant_id;

  if (typeof tenantId === "string" && tenantId.length > 0) {
    return tenantId;
  }

  return null;
};

const internalTasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/context", async (request, reply) => {
    const claims = request.supabaseClaims ?? null;
    if (!claims?.sub) {
      reply.status(401);
      return { error: "not_authenticated" };
    }

    const query = querySchema.parse(request.query ?? {});
    const productSlug = query.productSlug ?? DEFAULT_PRODUCT_SLUG;

    const organizationId = await resolveOrganizationId(claims);
    if (!organizationId) {
      request.log.warn({ userId: claims.sub }, "Missing organization context");
      reply.status(400);
      return { error: "organization_context_missing" };
    }

    const serviceClaims = buildServiceRoleClaims(organizationId);

    const [organization, entitlements, tenantSummaries, userProfile, userBulkJobs] = await Promise.all([
      getOrganizationById(serviceClaims, organizationId),
      listEntitlementsForUser(serviceClaims, claims.sub),
      listTenantSummariesForOrganization(serviceClaims, organizationId),
      getUserProfile(serviceClaims, claims.sub),
      listRecentBulkJobsImpactingUser(buildServiceRoleClaims(undefined, { role: "service_role" }), claims.sub, {
        actions: ["SUSPEND_USERS", "ACTIVATE_USERS", "EXPORT_USERS"],
        limit: 5
      })
    ]);

    if (!organization) {
      reply.status(404);
      return { error: "organization_not_found" };
    }

    const now = Date.now();
    const tasksEntitlements = entitlements.filter(
      (entitlement) =>
        entitlement.product.slug === productSlug &&
        (!entitlement.expiresAt || entitlement.expiresAt.getTime() >= now)
    );

    if (tasksEntitlements.length === 0) {
      reply.status(403);
      return { error: "tasks_product_access_required" };
    }

    const tenantNameMap = new Map<string, string>();
    for (const tenant of tenantSummaries) {
      tenantNameMap.set(tenant.id, tenant.name);
    }

    const tenantMembershipsForUser = await listTenantMembershipsForUser(
      serviceClaims,
      organizationId,
      claims.sub
    );
    const tenantRoleByTenantId = new Map<string, string>();
    for (const membership of tenantMembershipsForUser) {
      tenantRoleByTenantId.set(membership.tenantId, membership.role);
    }

    const entitlementsResponse = tasksEntitlements.map((entitlement) => {
      const fallbackRole = tenantRoleByTenantId.get(entitlement.tenantId) ?? "MEMBER";
      const productRoles =
        entitlement.roles && entitlement.roles.length > 0 ? entitlement.roles : [fallbackRole];
      return {
        id: entitlement.id,
        productId: entitlement.productId,
        productSlug: entitlement.product.slug,
        tenantId: entitlement.tenantId,
        tenantName: tenantNameMap.get(entitlement.tenantId) ?? null,
        roles: productRoles,
        expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null
      };
    });

    const preferredTenantId = query.tenantId ?? resolvePreferredTenantId(claims);

    const matchedByRequest = query.tenantId
      ? entitlementsResponse.find((ent) => ent.tenantId === query.tenantId)
      : undefined;
    const matchedByPreference =
      !matchedByRequest && preferredTenantId
        ? entitlementsResponse.find((ent) => ent.tenantId === preferredTenantId)
        : undefined;

    const activeEntitlement =
      matchedByRequest ??
      matchedByPreference ??
      entitlementsResponse[0]!;

    const source: "request" | "metadata" | "fallback" = matchedByRequest
      ? "request"
      : matchedByPreference
        ? "metadata"
        : "fallback";

    const activeTenantId = activeEntitlement.tenantId;
    const userId = claims.sub;

    let projectRecords: Awaited<ReturnType<typeof listProjectsForTenant>> = [];
    let projectSummaryRecords: Awaited<ReturnType<typeof listProjectSummariesForTenant>> = [];
    let permissionPolicyRecords: Awaited<ReturnType<typeof listPermissionPoliciesForUser>> = [];

    try {
      [projectRecords, projectSummaryRecords, permissionPolicyRecords] = await Promise.all([
        listProjectsForTenant(serviceClaims, activeTenantId, { includeArchived: true }),
        listProjectSummariesForTenant(serviceClaims, activeTenantId),
        listPermissionPoliciesForUser(serviceClaims, activeTenantId, userId)
      ]);
    } catch (error) {
      request.log.warn(
        { tenantId: activeTenantId, userId, error },
        "Failed to load tasks project metadata"
      );
      projectRecords = [];
      projectSummaryRecords = [];
      permissionPolicyRecords = [];
    }

    const projects = projectRecords.map((project) => ({
      id: project.id,
      tenantId: project.tenantId,
      name: project.name,
      description: project.description ?? null,
      color: project.color ?? null,
      archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    }));

    const projectSummaries = projectSummaryRecords.map((summary) => ({
      projectId: summary.projectId,
      name: summary.name,
      openCount: summary.openCount,
      overdueCount: summary.overdueCount,
      completedCount: summary.completedCount,
      scope: summary.scope
    }));

    const permissionEvaluator = buildTaskPermissionEvaluator({
      tenantId: activeTenantId,
      userId,
      identityRoles: activeEntitlement.roles,
      policies: permissionPolicyRecords
    });

    const effectivePermissions = {
      canView: permissionEvaluator("view"),
      canCreate: permissionEvaluator("create"),
      canEdit: permissionEvaluator("edit"),
      canComment: permissionEvaluator("comment"),
      canAssign: permissionEvaluator("assign"),
      canManage: permissionEvaluator("manage")
    };

    const userStatus = userProfile?.status ?? "ACTIVE";

    const staleNotificationCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const jobNotifications = (userBulkJobs ?? [])
      .filter((job) => {
        const updatedAt = Date.parse(job.updatedAt);
        return (
          !Number.isNaN(updatedAt) &&
          updatedAt >= staleNotificationCutoff &&
          (job.status === "SUCCEEDED" || job.status === "FAILED")
        );
      })
      .map((job) => ({
        id: job.id,
        type: "bulk-job" as const,
        title:
          job.status === "SUCCEEDED"
            ? job.action === "SUSPEND_USERS"
              ? "Suspension job succeeded"
              : job.action === "ACTIVATE_USERS"
                ? "Activation job succeeded"
                : "Bulk job completed"
            : "Bulk job completed with issues",
        description:
          job.status === "SUCCEEDED"
            ? job.progressMessage ?? "Bulk job completed successfully."
            : job.errorMessage ?? "Bulk job completed with failures.",
        createdAt: job.updatedAt,
        actionUrl: job.resultUrl,
        meta: {
          action: job.action,
          status: job.status,
          reason: job.reason,
          failedCount: job.failedCount,
          completedCount: job.completedCount,
          resultExpiresAt: job.resultExpiresAt
        }
      }));

    const response = {
      user: {
        id: claims.sub,
        email: claims.email ?? `${claims.sub}@example.com`,
        fullName: resolveFullName(claims),
        status: userStatus
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      product: {
        id: activeEntitlement.productId,
        slug: activeEntitlement.productSlug,
        name:
          tasksEntitlements.find((ent) => ent.id === activeEntitlement.id)?.product.name ??
          productSlug
      },
      entitlements: entitlementsResponse,
      tenants: tenantSummaries.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description,
        membersCount: tenant.membersCount,
        productsCount: tenant.productsCount
      })),
      activeTenant: {
        entitlementId: activeEntitlement.id,
        tenantId: activeEntitlement.tenantId,
        tenantName: activeEntitlement.tenantName,
        roles: activeEntitlement.roles,
        source
      },
      projects,
      projectSummaries,
      permissions: {
        roles: activeEntitlement.roles,
        effective: effectivePermissions
      },
      notifications: jobNotifications
    };

    const parsed = TasksContextResponseSchema.safeParse(response);
    if (!parsed.success) {
      request.log.error(
        { issues: parsed.error.issues },
        "Tasks context response failed validation"
      );
      reply.status(500);
      return { error: "tasks_context_response_invalid" };
    }

    reply.header("Cache-Control", "no-store");
    return parsed.data;
  });

  fastify.get("/users", async (request, reply) => {
    const claims = request.supabaseClaims ?? null;
    if (!claims?.sub) {
      reply.status(401);
      return { error: "not_authenticated" };
    }

    const query = usersQuerySchema.parse(request.query ?? {});
    const requestedIds = query.userId;
    let uniqueIds = Array.isArray(requestedIds)
      ? Array.from(new Set(requestedIds))
      : requestedIds
        ? [requestedIds]
        : [];

    const productSlug = query.productSlug ?? DEFAULT_PRODUCT_SLUG;

    const organizationId = await resolveOrganizationId(claims);
    if (!organizationId) {
      request.log.warn({ userId: claims.sub }, "Missing organization context");
      reply.status(400);
      return { error: "organization_context_missing" };
    }

    const serviceClaims = buildServiceRoleClaims(organizationId);
    const entitlements = await listEntitlementsForUser(serviceClaims, claims.sub);
    const tasksEntitlements = entitlements.filter(
      (entitlement) =>
        entitlement.product.slug === productSlug &&
        (!entitlement.expiresAt || entitlement.expiresAt.getTime() >= Date.now())
    );

    if (tasksEntitlements.length === 0) {
      reply.status(403);
      return { error: "tasks_product_access_required" };
    }

    if (query.tenantId) {
      const hasTenantAccess = tasksEntitlements.some(
        (entitlement) => entitlement.tenantId === query.tenantId
      );
      if (!hasTenantAccess) {
        reply.status(403);
        return { error: "tasks_product_access_required" };
      }
    }

    if (uniqueIds.length === 0) {
      const allowedProductIds = new Set(tasksEntitlements.map((entitlement) => entitlement.productId));
      const allowedTenantIds = new Set(tasksEntitlements.map((entitlement) => entitlement.tenantId));

      let entitlementRecords =
        query.tenantId != null
          ? await listEntitlementsForTenant(serviceClaims, query.tenantId)
          : await listEntitlementsForOrganization(serviceClaims, organizationId);

      if (query.tenantId == null) {
        entitlementRecords = entitlementRecords.filter((record) => allowedTenantIds.has(record.tenantId));
      }

      uniqueIds = Array.from(
        new Set(
          entitlementRecords
            .filter((record) => allowedProductIds.has(record.productId))
            .map((record) => record.userId)
        )
      );
    }

    if (uniqueIds.length === 0) {
      reply.header("Cache-Control", "no-store");
      return { users: [] };
    }

    const members = await withAuthorizationTransaction(serviceClaims, (tx) =>
      tx.organizationMember.findMany({
        where: {
          organizationId,
          userId: { in: uniqueIds }
        },
        include: {
          user: {
            select: {
              email: true,
              fullName: true
            }
          }
        }
      })
    );

    const response = {
      users: members.map((member) => ({
        id: member.userId,
        email: member.user.email ?? null,
        fullName:
          typeof member.user.fullName === "string" && member.user.fullName.trim().length > 0
            ? member.user.fullName.trim()
            : null
      }))
    };

    const parsed = TasksUsersResponseSchema.safeParse(response);
    if (!parsed.success) {
      request.log.error(
        { issues: parsed.error.issues },
        "Tasks users response failed validation"
      );
      reply.status(500);
      return { error: "tasks_users_response_invalid" };
    }

    reply.header("Cache-Control", "no-store");
    return parsed.data;
  });
};

export default internalTasksRoutes;
