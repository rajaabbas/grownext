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
  SuperAdminEntitlementRevokeRequestSchema
} from "@ma/contracts";
import {
  getUserForSuperAdmin,
  listUsersForSuperAdmin,
  updateOrganizationMemberRole,
  updateTenantMemberRole,
  grantEntitlement,
  revokeEntitlement,
  recordAuditEvent,
  type OrganizationRole,
  type TenantRole,
  type ProductRole
} from "@ma/db";

const SUPER_ADMIN_ROLE = "super-admin";
const SUPPORT_ROLE = "support";
const AUDITOR_ROLE = "auditor";

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

      const user = await getUserForSuperAdmin(
        buildServiceRoleClaims(undefined, { role: "service_role", sub: request.supabaseClaims?.sub }),
        params.userId
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
          description: `Super Admin revoked entitlement for user ${params.userId}`
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
};

export default superAdminRoutes;
