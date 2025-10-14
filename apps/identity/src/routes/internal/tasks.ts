import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  getOrganizationById,
  listEntitlementsForUser,
  listTenantSummariesForOrganization,
  withAuthorizationTransaction
} from "@ma/db";
import { TasksContextResponseSchema, TasksUsersResponseSchema } from "@ma/contracts";

const querySchema = z.object({
  productSlug: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional()
});

const usersQuerySchema = z.object({
  userId: z.union([z.string().min(1), z.array(z.string().min(1))]),
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

    const [organization, entitlements, tenantSummaries] = await Promise.all([
      getOrganizationById(serviceClaims, organizationId),
      listEntitlementsForUser(serviceClaims, claims.sub),
      listTenantSummariesForOrganization(serviceClaims, organizationId)
    ]);

    if (!organization) {
      reply.status(404);
      return { error: "organization_not_found" };
    }

    const tasksEntitlements = entitlements.filter(
      (entitlement) => entitlement.product.slug === productSlug
    );

    if (tasksEntitlements.length === 0) {
      reply.status(403);
      return { error: "tasks_product_access_required" };
    }

    const tenantNameMap = new Map<string, string>();
    for (const tenant of tenantSummaries) {
      tenantNameMap.set(tenant.id, tenant.name);
    }

    const entitlementsResponse = tasksEntitlements.map((entitlement) => ({
      id: entitlement.id,
      productId: entitlement.productId,
      productSlug: entitlement.product.slug,
      tenantId: entitlement.tenantId,
      tenantName: tenantNameMap.get(entitlement.tenantId) ?? null,
      roles: entitlement.roles,
      expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null
    }));

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

    const response = {
      user: {
        id: claims.sub,
        email: claims.email ?? `${claims.sub}@example.com`,
        fullName: resolveFullName(claims)
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
      }
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
    const userIds = Array.isArray(query.userId) ? query.userId : [query.userId];
    const uniqueIds = Array.from(new Set(userIds));

    if (uniqueIds.length === 0) {
      reply.status(400);
      return { error: "user_ids_required" };
    }

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
      (entitlement) => entitlement.product.slug === productSlug
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
