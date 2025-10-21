import { createHash, randomBytes } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createOrganizationWithOwner,
  listOrganizationMembers,
  listTenants,
  createTenant,
  createOrganizationInvitation,
  updateOrganization,
  listOrganizationInvitations,
  getOrganizationMember,
  grantEntitlement,
  getTenantById,
  getTenantBySlug,
  listTenantMembers,
  listTenantApplications,
  attachMemberToTenant,
  removeTenantMember,
  updateTenant,
  deleteTenant,
  removeOrganizationMember,
  deleteOrganization,
  listProducts,
  listEntitlementsForOrganization,
  listEntitlementsForTenant,
  getEntitlementById,
  revokeEntitlement,
  linkProductToTenant,
  unlinkProductFromTenant,
  recordAuditEvent,
  listAuditEvents,
  withAuthorizationTransaction,
  createSamlConnection,
  updateSamlConnection,
  deleteSamlConnection,
  listSamlConnectionsForOrganization,
  getSamlConnectionById,
  supabaseServiceClient
} from "@ma/db";
import type { ProductRole, TenantRole, AuditEventType, SamlConnection } from "@ma/db";
import {
  CreateSamlConnectionRequestSchema,
  SamlConnectionSchema,
  UpdateSamlConnectionRequestSchema
} from "@ma/contracts";
import { buildServiceRoleClaims, env } from "@ma/core";
import { deleteTasksForTenant } from "@ma/tasks-db";

const TENANT_ROLE_VALUES = ["ADMIN", "MEMBER"] as const satisfies readonly TenantRole[];

const IDENTITY_EVENT_NAMES = {
  ORGANIZATION_CREATED: "organization.created",
  TENANT_CREATED: "tenant.created",
  ENTITLEMENT_GRANTED: "entitlement.granted"
} as const;

const USER_MANAGEMENT_EVENT_NAMES = {
  INVITATION_CREATED: "organization.invitation.created"
} as const;

const ensureAuthenticated = (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.supabaseClaims?.sub) {
    reply.status(401);
    throw new Error("not_authenticated");
  }
};

const requireOrgAdmin = async (
  organizationId: string,
  userId: string
) => {
  const member = await getOrganizationMember(buildServiceRoleClaims(organizationId), organizationId, userId);
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    const error = new Error("forbidden") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
};

const stripOrganizationContext = (metadata: unknown): Record<string, unknown> => {
  const sanitized =
    metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};

  const keysToClear = [
    "organization_id",
    "organization_name",
    "organization_role",
    "organization_member_id",
    "tenant_id",
    "tenant_name",
    "tenant_roles",
    "portal_last_tenant_id",
    "portal_selected_tenant_id"
  ];

  for (const key of keysToClear) {
    sanitized[key] = null;
  }

  return sanitized;
};

const resolveTenant = async (tenantIdentifier: string) => {
  const serviceClaims = buildServiceRoleClaims(undefined);
  const tenantById = await getTenantById(serviceClaims, tenantIdentifier);
  if (tenantById) {
    return tenantById;
  }
  return getTenantBySlug(serviceClaims, tenantIdentifier);
};

const sanitizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const buildSamlAcsUrl = (slug: string): string => {
  const base = sanitizeBaseUrl(env.IDENTITY_ISSUER);
  return `${base}/saml/${slug}/acs`;
};

const formatSamlConnection = (connection: SamlConnection) =>
  SamlConnectionSchema.parse({
    id: connection.id,
    organizationId: connection.organizationId,
    slug: connection.slug,
    label: connection.label,
    idpEntityId: connection.idpEntityId,
    ssoUrl: connection.ssoUrl,
    sloUrl: connection.sloUrl,
    acsUrl: connection.acsUrl,
    metadataUrl: connection.metadataUrl,
    metadataXmlPresent: connection.metadataXml !== null,
    certificates: connection.certificates,
    defaultRelayState: connection.defaultRelayState ?? null,
    enabled: connection.enabled,
    requireSignedAssertions: connection.requireSignedAssertions,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  });

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/organizations",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const bodySchema = z.object({
        name: z.string().min(2),
        slug: z.string().optional(),
        defaultTenantName: z.string().optional()
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: parsed.error.message };
      }

      let organization: Awaited<ReturnType<typeof createOrganizationWithOwner>>["organization"];
      let defaultTenant: Awaited<ReturnType<typeof createOrganizationWithOwner>>["defaultTenant"];

      try {
        ({ organization, defaultTenant } = await createOrganizationWithOwner({
          name: parsed.data.name,
          slug: parsed.data.slug,
          defaultTenantName: parsed.data.defaultTenantName,
          owner: {
            userId: request.supabaseClaims!.sub,
            email: request.supabaseClaims!.email ?? "",
            fullName: (request.supabaseClaims!.user_metadata?.full_name as string | undefined) ?? "Owner"
          }
        }));
      } catch (error) {
        if ((error as Error).name === "OrganizationSlugConflictError") {
          reply.status(409);
          return { error: "organization_slug_in_use" };
        }
        throw error;
      }

      const currentUserMetadata = (request.supabaseClaims?.user_metadata ?? {}) as Record<string, unknown>;
      const currentAppMetadata =
        typeof request.supabaseClaims?.app_metadata === "object" && request.supabaseClaims?.app_metadata !== null
          ? (request.supabaseClaims.app_metadata as Record<string, unknown>)
          : {};

      try {
        await supabaseServiceClient.auth.admin.updateUserById(request.supabaseClaims!.sub, {
          user_metadata: {
            ...currentUserMetadata,
            organization_id: organization.id,
            tenant_id: defaultTenant.id
          },
          app_metadata: {
            ...currentAppMetadata,
            organization_id: organization.id,
            tenant_id: defaultTenant.id
          }
        });
      } catch (metadataError) {
        request.log.error(
          { err: metadataError, organizationId: organization.id },
          "Failed to update Supabase metadata after organization creation"
        );
      }

      await recordAuditEvent(buildServiceRoleClaims(organization.id), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: organization.id,
        tenantId: defaultTenant.id,
        description: "Organization created via admin endpoint"
      });

      await fastify.queues.emitIdentityEvent(IDENTITY_EVENT_NAMES.ORGANIZATION_CREATED, {
        organizationId: organization.id,
        ownerUserId: request.supabaseClaims!.sub
      });

      reply.status(201);
      return { organization, defaultTenant };
    }
  );

  fastify.get(
    "/organizations/:organizationId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);

      const membership = await getOrganizationMember(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        request.supabaseClaims!.sub
      );

      if (!membership) {
        reply.status(403);
        return { error: "forbidden" };
      }

      const role = membership.role.toUpperCase();
      const allowedViewerRoles = new Set(["OWNER", "ADMIN", "MANAGER", "MEMBER"]);
      if (!allowedViewerRoles.has(role)) {
        reply.status(403);
        return { error: "forbidden" };
      }

      const canViewInvitations = role === "OWNER" || role === "ADMIN" || role === "MANAGER";

      const [tenants, members] = await Promise.all([
        listTenants(buildServiceRoleClaims(params.organizationId), params.organizationId),
        listOrganizationMembers(buildServiceRoleClaims(params.organizationId), params.organizationId)
      ]);

      const invitations = canViewInvitations
        ? await listOrganizationInvitations(buildServiceRoleClaims(params.organizationId), params.organizationId)
        : [];

      const serializedInvitations = invitations.map((invitation) => {
        const { tokenHash, ...rest } = invitation;
        void tokenHash;
        return rest;
      });

      return {
        organizationId: params.organizationId,
        tenants,
        members,
        invitations: serializedInvitations
      };
    }
  );

  fastify.patch(
    "/organizations/:organizationId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          name: z.string().min(2),
          slug: z.string().min(1).optional()
        })
        .parse(request.body);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const updated = await updateOrganization(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        { name: body.name, slug: body.slug }
      );

      await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        description: `Organization profile updated`
      });

      return {
        organization: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          updatedAt: updated.updatedAt.toISOString()
        }
      };
    }
  );

  fastify.delete(
    "/organizations/:organizationId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);

      const membership = await getOrganizationMember(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        request.supabaseClaims!.sub
      );

      if (!membership) {
        reply.status(403);
        return { error: "forbidden" };
      }

      if (membership.role !== "OWNER") {
        reply.status(403);
        return { error: "only_owners_may_delete_organization" };
      }

      const serviceClaims = buildServiceRoleClaims(params.organizationId);
      const [tenants, organizationMembers] = await Promise.all([
        listTenants(serviceClaims, params.organizationId),
        listOrganizationMembers(serviceClaims, params.organizationId)
      ]);

      for (const tenant of tenants) {
        await deleteTasksForTenant(serviceClaims, tenant.id);
      }

      const deleted = await deleteOrganization(serviceClaims, params.organizationId);

      if (!deleted) {
        reply.status(404);
        return { error: "organization_not_found" };
      }

      await Promise.all(
        organizationMembers.map(async (member) => {
          try {
            const { data: supabaseUser, error: supabaseError } =
              await supabaseServiceClient.auth.admin.getUserById(member.userId);

            if (supabaseError || !supabaseUser?.user) {
              request.log.warn(
                {
                  userId: member.userId,
                  error: supabaseError?.message ?? null
                },
                "Unable to load Supabase user while clearing organization context"
              );
              return;
            }

            const sanitizedUserMetadata = stripOrganizationContext(supabaseUser.user.user_metadata);
            const sanitizedAppMetadata = stripOrganizationContext(supabaseUser.user.app_metadata);

            await supabaseServiceClient.auth.admin.updateUserById(member.userId, {
              user_metadata: sanitizedUserMetadata,
              app_metadata: sanitizedAppMetadata
            });
          } catch (metadataError) {
            request.log.error(
              { err: metadataError, userId: member.userId },
              "Failed to clear Supabase metadata after organization deletion"
            );
          }
        })
      );

      await recordAuditEvent(serviceClaims, {
        eventType: "ORGANIZATION_UPDATED" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: null,
        description: "Organization deleted",
        metadata: {
          organization: {
            id: deleted.id,
            name: deleted.name,
            slug: deleted.slug
          }
        }
      });

      reply.status(204);
      return null;
    }
  );

  fastify.get(
    "/organizations/:organizationId/products",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const [products, entitlements] = await Promise.all([
        listProducts(buildServiceRoleClaims(params.organizationId)),
        listEntitlementsForOrganization(buildServiceRoleClaims(params.organizationId), params.organizationId)
      ]);

      return {
        products: products.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          iconUrl: product.iconUrl,
          launcherUrl: product.launcherUrl
        })),
        entitlements
      };
    }
  );

  fastify.post(
    "/organizations/:organizationId/tenants",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          name: z.string().min(2),
          description: z.string().optional(),
          role: z.enum(TENANT_ROLE_VALUES).default("ADMIN")
        })
        .parse(request.body);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const membership = await getOrganizationMember(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        request.supabaseClaims!.sub
      );

      if (!membership) {
        reply.status(403);
        return { error: "User is not part of organization" };
      }

      const result = await createTenant(buildServiceRoleClaims(params.organizationId), {
        organizationId: params.organizationId,
        name: body.name,
        description: body.description,
        grantingMemberId: membership.id,
        role: body.role as TenantRole
      });

      await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
        eventType: "TENANT_CREATED" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        tenantId: result.tenant.id,
        description: `Tenant ${result.tenant.name} created`
      });

      await fastify.queues.emitIdentityEvent(IDENTITY_EVENT_NAMES.TENANT_CREATED, {
        organizationId: params.organizationId,
        tenantId: result.tenant.id,
        createdBy: request.supabaseClaims!.sub
      });

      reply.status(201);
      return result;
    }
  );

  fastify.get(
    "/tenants/:tenantId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      const serviceClaims = buildServiceRoleClaims(tenant.organizationId);

      const member = await getOrganizationMember(serviceClaims, tenant.organizationId, request.supabaseClaims!.sub);

      const isOrgManager = member && (member.role === "OWNER" || member.role === "ADMIN");

      let hasTenantAccess = false;
      if (!isOrgManager) {
        const tenantMember = await withAuthorizationTransaction(serviceClaims, (tx) =>
          tx.tenantMember.findFirst({
            where: {
              tenantId: tenant.id,
              organizationMember: {
                userId: request.supabaseClaims!.sub
              }
            }
          })
        );
        hasTenantAccess = !!tenantMember;
      }

      if (!isOrgManager && !hasTenantAccess) {
        reply.status(403);
        return { error: "forbidden" };
      }

      const [members, organizationMembers, entitlements, applications] = await Promise.all([
        listTenantMembers(serviceClaims, tenant.id),
        listOrganizationMembers(serviceClaims, tenant.organizationId),
        listEntitlementsForTenant(serviceClaims, tenant.id),
        listTenantApplications(serviceClaims, tenant.id)
      ]);

      return {
        tenant: {
          id: tenant.id,
          organizationId: tenant.organizationId,
          name: tenant.name,
          slug: tenant.slug,
          description: tenant.description,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString()
        },
        members: members.map((member) => ({
          id: member.id,
          tenantId: member.tenantId,
          organizationMemberId: member.organizationMemberId,
          role: member.role,
          createdAt: member.createdAt.toISOString(),
          updatedAt: member.updatedAt.toISOString(),
          organizationMember: {
            id: member.organizationMember.id,
            userId: member.organizationMember.userId,
            role: member.organizationMember.role,
            user: {
              email: member.organizationMember.user.email,
              fullName: member.organizationMember.user.fullName
            }
          }
        })),
        organizationMembers: organizationMembers.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt.toISOString(),
          updatedAt: member.updatedAt.toISOString(),
          user: {
            email: member.user.email,
            fullName: member.user.fullName
          }
        })),
        applications: applications.map((application) => ({
          id: application.id,
          tenantId: application.tenantId,
          productId: application.productId,
          environment: application.environment,
          consentRequired: application.consentRequired,
          createdAt: application.createdAt.toISOString(),
          updatedAt: application.updatedAt.toISOString(),
          product: {
            id: application.product.id,
            name: application.product.name,
            slug: application.product.slug,
            description: application.product.description,
            iconUrl: application.product.iconUrl,
            launcherUrl: application.product.launcherUrl
          }
        })),
        entitlements: entitlements.map((entitlement) => ({
          id: entitlement.id,
          organizationId: entitlement.organizationId,
          tenantId: entitlement.tenantId,
          productId: entitlement.productId,
          userId: entitlement.userId,
          roles: entitlement.roles,
          expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null,
          createdAt: entitlement.createdAt.toISOString(),
          updatedAt: entitlement.updatedAt.toISOString()
        }))
      };
    }
  );

  fastify.patch(
    "/tenants/:tenantId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          name: z.string().min(2),
          description: z.string().nullable().optional()
        })
        .parse(request.body);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const updated = await updateTenant(buildServiceRoleClaims(tenant.organizationId), tenant.id, {
        name: body.name,
        description: body.description ?? null
      });

      reply.status(200);
      return {
        tenant: {
          id: updated.id,
          organizationId: updated.organizationId,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString()
        }
      };
    }
  );

  fastify.delete(
    "/tenants/:tenantId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(tenant.organizationId);
      await deleteTasksForTenant(serviceClaims, tenant.id);
      await deleteTenant(serviceClaims, tenant.id);

      reply.status(204);
      return null;
    }
  );

  fastify.post(
    "/tenants/:tenantId/entitlements",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          organizationId: z.string().min(1),
          productId: z.string().min(1),
          userId: z.string().min(1),
          expiresAt: z.string().datetime().optional()
        })
        .parse(request.body);

      await requireOrgAdmin(body.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(body.organizationId);
      const tenantMembersForOrg = await listTenantMembers(serviceClaims, params.tenantId);
      const targetMember = tenantMembersForOrg.find(
        (member) => member.organizationMember.userId === body.userId
      );

      if (!targetMember) {
        reply.status(404);
        return { error: "tenant_member_not_found" };
      }

      const productRoles: ProductRole[] =
        targetMember.role === "ADMIN" ? ["ADMIN"] : ["MEMBER"];

      const entitlement = await grantEntitlement(serviceClaims, {
        organizationId: body.organizationId,
        tenantId: params.tenantId,
        productId: body.productId,
        userId: body.userId,
        roles: productRoles,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
      });

      await recordAuditEvent(buildServiceRoleClaims(body.organizationId), {
        eventType: "ENTITLEMENT_GRANTED" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: body.organizationId,
        tenantId: params.tenantId,
        productId: body.productId,
        description: `Entitlement granted to ${body.userId}`,
        metadata: { roles: productRoles }
      });

      await fastify.queues.emitIdentityEvent(IDENTITY_EVENT_NAMES.ENTITLEMENT_GRANTED, {
        organizationId: body.organizationId,
        tenantId: params.tenantId,
        productId: body.productId,
        userId: body.userId,
        roles: productRoles
      });

      reply.status(201);
      return entitlement;
    }
  );

  fastify.post(
    "/tenants/:tenantId/apps",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);
      const body = z.object({ productId: z.string().min(1) }).parse(request.body);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const application = await linkProductToTenant(buildServiceRoleClaims(tenant.organizationId), {
        tenantId: tenant.id,
        productId: body.productId
      });

      reply.status(201);
      return {
        application: {
          id: application.id,
          tenantId: application.tenantId,
          productId: application.productId,
          environment: application.environment,
          consentRequired: application.consentRequired,
          createdAt: application.createdAt.toISOString(),
          updatedAt: application.updatedAt.toISOString()
        }
      };
    }
  );

  fastify.delete(
    "/tenants/:tenantId/apps/:productId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z
        .object({ tenantId: z.string().min(1), productId: z.string().min(1) })
        .parse(request.params);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(tenant.organizationId);

      await unlinkProductFromTenant(serviceClaims, {
        tenantId: tenant.id,
        productId: params.productId
      });

      const entitlements = await listEntitlementsForTenant(serviceClaims, tenant.id);
      const matchingEntitlements = entitlements.filter((entitlement) => entitlement.productId === params.productId);

      await Promise.all(
        matchingEntitlements.map((entitlement) =>
          revokeEntitlement(serviceClaims, {
            organizationId: entitlement.organizationId,
            tenantId: entitlement.tenantId,
            productId: entitlement.productId,
            userId: entitlement.userId
          })
        )
      );

      reply.status(204);
      return null;
    }
  );

  fastify.post(
    "/tenants/:tenantId/members",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z.object({ tenantId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          organizationMemberId: z.string().min(1),
          role: z.enum(TENANT_ROLE_VALUES).default("MEMBER")
        })
        .parse(request.body);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const membership = await attachMemberToTenant(
        buildServiceRoleClaims(tenant.organizationId),
        params.tenantId,
        body.organizationMemberId,
        body.role as TenantRole
      );

      reply.status(201);
      return { membership };
    }
  );

  fastify.patch(
    "/tenants/:tenantId/members/:organizationMemberId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z
        .object({
          tenantId: z.string().min(1),
          organizationMemberId: z.string().min(1)
        })
        .parse(request.params);
      const body = z
        .object({
          role: z.enum(TENANT_ROLE_VALUES)
        })
        .parse(request.body);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const membership = await attachMemberToTenant(
        buildServiceRoleClaims(tenant.organizationId),
        params.tenantId,
        params.organizationMemberId,
        body.role as TenantRole
      );

      reply.status(200);
      return { membership };
    }
  );

  fastify.delete(
    "/tenants/:tenantId/members/:organizationMemberId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z
        .object({
          tenantId: z.string().min(1),
          organizationMemberId: z.string().min(1)
        })
        .parse(request.params);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      await removeTenantMember(
        buildServiceRoleClaims(tenant.organizationId),
        params.tenantId,
        params.organizationMemberId
      );

      reply.status(204);
      return null;
    }
  );

  fastify.delete(
    "/tenants/:tenantId/entitlements/:entitlementId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z
        .object({
          tenantId: z.string().min(1),
          entitlementId: z.string().min(1)
        })
        .parse(request.params);

      const tenant = await resolveTenant(params.tenantId);

      if (!tenant) {
        reply.status(404);
        return { error: "tenant_not_found" };
      }

      await requireOrgAdmin(tenant.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(tenant.organizationId);
      const entitlement = await getEntitlementById(serviceClaims, params.entitlementId);

      if (!entitlement || entitlement.tenantId !== params.tenantId) {
        reply.status(404);
        return { error: "entitlement_not_found" };
      }

      await revokeEntitlement(serviceClaims, {
        organizationId: entitlement.organizationId,
        tenantId: entitlement.tenantId,
        productId: entitlement.productId,
        userId: entitlement.userId
      });

      reply.status(204);
      return null;
    }
  );

  fastify.delete(
    "/organizations/:organizationId/members/:organizationMemberId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const params = z
        .object({
          organizationId: z.string().min(1),
          organizationMemberId: z.string().min(1)
        })
        .parse(request.params);

      const membership = await getOrganizationMember(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        request.supabaseClaims!.sub
      );

      if (!membership) {
        reply.status(403);
        return { error: "forbidden" };
      }

      const actingRole = membership.role.toUpperCase();
      if (!["OWNER", "ADMIN", "MANAGER"].includes(actingRole)) {
        reply.status(403);
        return { error: "forbidden" };
      }

      const targetMember = await withAuthorizationTransaction(
        buildServiceRoleClaims(params.organizationId),
        (tx) => tx.organizationMember.findUnique({ where: { id: params.organizationMemberId } })
      );

      if (!targetMember || targetMember.organizationId !== params.organizationId) {
        reply.status(404);
        return { error: "member_not_found" };
      }

      if (targetMember.userId === request.supabaseClaims!.sub && actingRole === "OWNER") {
        reply.status(400);
        return { error: "owners_cannot_remove_themselves" };
      }

      if (targetMember.role === "OWNER") {
        const remainingOwners = await withAuthorizationTransaction(
          buildServiceRoleClaims(params.organizationId),
          (tx) =>
            tx.organizationMember.count({
              where: {
                organizationId: params.organizationId,
                role: "OWNER"
              }
            })
        );

        if (remainingOwners <= 1) {
          reply.status(400);
          return { error: "organization_requires_owner" };
        }
      }

      const removed = await removeOrganizationMember(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId,
        params.organizationMemberId
      );

      if (!removed) {
        reply.status(404);
        return { error: "member_not_found" };
      }

      await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        description: `Removed organization member ${removed.user.email}`
      });

      reply.status(204);
      return null;
    }
  );

  fastify.post(
    "/organizations/:organizationId/invitations",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          email: z.string().email(),
          role: z.string().default("MEMBER"),
          tenantId: z.string().optional(),
          tenantRoles: z.array(z.enum(TENANT_ROLE_VALUES)).optional(),
          productIds: z.array(z.string()).optional(),
          expiresInHours: z.number().int().positive().default(72)
        })
        .parse(request.body);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const existingInvitation = await withAuthorizationTransaction(
        buildServiceRoleClaims(params.organizationId),
        (tx) =>
          tx.organizationInvitation.findFirst({
            where: {
              organizationId: params.organizationId,
              email: { equals: body.email, mode: "insensitive" },
              status: "PENDING"
            },
            orderBy: { createdAt: "desc" }
          })
      );

      if (existingInvitation && existingInvitation.expiresAt.getTime() > Date.now()) {
        reply.status(409);
        return { error: "invitation_already_pending" };
      }

      const token = randomBytes(48).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const invitation = await withAuthorizationTransaction(
        buildServiceRoleClaims(params.organizationId),
        (tx) =>
          createOrganizationInvitation(tx, {
            organizationId: params.organizationId,
            email: body.email,
            role: body.role,
            tenantId: body.tenantId,
          tenantRoles: body.tenantRoles as TenantRole[] | undefined,
            productIds: body.productIds,
            invitedById: request.supabaseClaims!.sub,
            expiresAt: new Date(Date.now() + body.expiresInHours * 3600 * 1000),
            tokenHash,
            tokenHint: `${body.email.slice(0, 2)}***`,
            issuedIp: request.ip
          })
      );

      await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        tenantId: body.tenantId,
        description: `Invitation issued for ${body.email}`
      });

      await fastify.queues.emitUserManagementJob(USER_MANAGEMENT_EVENT_NAMES.INVITATION_CREATED, {
        invitationId: invitation.id,
        organizationId: params.organizationId,
        email: body.email,
        role: body.role,
        issuedBy: request.supabaseClaims!.sub,
        token
      });

      reply.status(201);
      return { invitation, token };
    }
  );

  fastify.delete(
    "/organizations/:organizationId/invitations/:invitationId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const params = z
        .object({
          organizationId: z.string().min(1),
          invitationId: z.string().min(1)
        })
        .parse(request.params);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const invitation = await withAuthorizationTransaction(
        buildServiceRoleClaims(params.organizationId),
        (tx) =>
          tx.organizationInvitation.findUnique({
            where: { id: params.invitationId }
          })
      );

      if (!invitation || invitation.organizationId !== params.organizationId) {
        reply.status(404);
        return { error: "invitation_not_found" };
      }

      await withAuthorizationTransaction(buildServiceRoleClaims(params.organizationId), (tx) =>
        tx.organizationInvitation.delete({ where: { id: invitation.id } })
      );

      await recordAuditEvent(buildServiceRoleClaims(params.organizationId), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        tenantId: invitation.tenantId,
        description: `Invitation revoked for ${invitation.email}`
      });

      reply.status(204);
      return null;
    }
  );

  fastify.get(
    "/organizations/:organizationId/saml/connections",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const samlService = fastify.samlService;
      if (!samlService) {
        reply.status(503);
        return { error: "saml_not_configured" };
      }

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const connections = await listSamlConnectionsForOrganization(
        buildServiceRoleClaims(params.organizationId),
        params.organizationId
      );

      return {
        connections: connections.map((connection) => formatSamlConnection(connection))
      };
    }
  );

  fastify.post(
    "/organizations/:organizationId/saml/connections",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const samlService = fastify.samlService;
      if (!samlService) {
        reply.status(503);
        return { error: "saml_not_configured" };
      }

      const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);
      const parsedBody = CreateSamlConnectionRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        reply.status(400);
        return { error: "invalid_request", details: parsedBody.error.flatten() };
      }

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const body = parsedBody.data;

      let idpEntityId: string;
      let ssoUrl: string;
      let sloUrl: string | null = body.sloUrl ?? null;
      let certificates: string[];
      const metadataXml: string | null = body.metadataXml?.trim() ?? null;

      if (metadataXml) {
        try {
          const metadata = samlService.parseIdentityProviderMetadata(metadataXml);
          idpEntityId = metadata.entityId;
          ssoUrl = metadata.singleSignOnService.location;
          sloUrl = body.sloUrl ?? metadata.singleLogoutService?.location ?? null;
          certificates = metadata.signingCertificates;
        } catch (error) {
          reply.status(400);
          return { error: "invalid_metadata", detail: (error as Error).message };
        }
      } else {
        idpEntityId = body.idpEntityId!;
        ssoUrl = body.ssoUrl!;
        certificates = body.signingCertificates!;
      }

      const acsUrl = buildSamlAcsUrl(body.slug);
      const serviceClaims = buildServiceRoleClaims(params.organizationId);

      try {
        const connection = await createSamlConnection(serviceClaims, {
          organizationId: params.organizationId,
          slug: body.slug,
          label: body.label,
          idpEntityId,
          ssoUrl,
          sloUrl,
          certificates,
          metadataXml,
          metadataUrl: body.metadataUrl ?? null,
          acsUrl,
          defaultRelayState: body.defaultRelayState ?? null,
          requireSignedAssertions: body.requireSignedAssertions ?? true,
          enabled: true
        });

        await recordAuditEvent(serviceClaims, {
          eventType: "ADMIN_ACTION" as AuditEventType,
          actorUserId: request.supabaseClaims!.sub,
          organizationId: params.organizationId,
          description: `SAML connection created (${connection.slug})`
        });

        reply.status(201);
        return { connection: formatSamlConnection(connection) };
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "P2002") {
          reply.status(409);
          return { error: "saml_slug_conflict" };
        }
        request.log.error({ error }, "Failed to create SAML connection");
        reply.status(500);
        return { error: "saml_connection_create_failed" };
      }
    }
  );

  fastify.patch(
    "/organizations/:organizationId/saml/connections/:connectionId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const samlService = fastify.samlService;
      if (!samlService) {
        reply.status(503);
        return { error: "saml_not_configured" };
      }

      const params = z
        .object({ organizationId: z.string().min(1), connectionId: z.string().min(1) })
        .parse(request.params);
      const parsedBody = UpdateSamlConnectionRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        reply.status(400);
        return { error: "invalid_request", details: parsedBody.error.flatten() };
      }

      const body = parsedBody.data;
      if (Object.keys(body).length === 0) {
        reply.status(400);
        return { error: "no_updates_specified" };
      }

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(params.organizationId);
      const existing = await getSamlConnectionById(serviceClaims, params.connectionId);

      if (!existing || existing.organizationId !== params.organizationId) {
        reply.status(404);
        return { error: "saml_connection_not_found" };
      }

      let idpEntityId = existing.idpEntityId;
      let ssoUrl = existing.ssoUrl;
      let sloUrl = existing.sloUrl;
      let certificates = existing.certificates;
      let metadataXml = existing.metadataXml;
      const metadataUrl = body.metadataUrl !== undefined ? body.metadataUrl ?? null : existing.metadataUrl;
      const defaultRelayState =
        body.defaultRelayState !== undefined ? body.defaultRelayState ?? null : existing.defaultRelayState;
      const requireSignedAssertions =
        body.requireSignedAssertions !== undefined
          ? body.requireSignedAssertions
          : existing.requireSignedAssertions;
      const enabled = body.enabled ?? existing.enabled;
      const label = body.label ?? existing.label;

      if (body.metadataXml) {
        metadataXml = body.metadataXml;
        try {
          const metadata = samlService.parseIdentityProviderMetadata(body.metadataXml);
          idpEntityId = metadata.entityId;
          ssoUrl = metadata.singleSignOnService.location;
          sloUrl = body.sloUrl ?? metadata.singleLogoutService?.location ?? null;
          certificates = metadata.signingCertificates;
        } catch (error) {
          reply.status(400);
          return { error: "invalid_metadata", detail: (error as Error).message };
        }
      } else if (
        body.idpEntityId ||
        body.ssoUrl ||
        body.signingCertificates ||
        body.sloUrl !== undefined
      ) {
        metadataXml = null;
        idpEntityId = body.idpEntityId ?? idpEntityId;
        ssoUrl = body.ssoUrl ?? ssoUrl;
        if (body.sloUrl !== undefined) {
          sloUrl = body.sloUrl;
        }
        if (body.signingCertificates) {
          certificates = body.signingCertificates;
        }
      }

      try {
        const updated = await updateSamlConnection(serviceClaims, {
          samlConnectionId: existing.id,
          label,
          idpEntityId,
          ssoUrl,
          sloUrl,
          certificates,
          metadataXml,
          metadataUrl,
          requireSignedAssertions,
          enabled,
          defaultRelayState
        });

        await recordAuditEvent(serviceClaims, {
          eventType: "ADMIN_ACTION" as AuditEventType,
          actorUserId: request.supabaseClaims!.sub,
          organizationId: params.organizationId,
          description: `SAML connection updated (${updated.slug})`
        });

        return { connection: formatSamlConnection(updated) };
      } catch (error) {
        request.log.error({ error }, "Failed to update SAML connection");
        reply.status(500);
        return { error: "saml_connection_update_failed" };
      }
    }
  );

  fastify.delete(
    "/organizations/:organizationId/saml/connections/:connectionId",
    async (request, reply) => {
      ensureAuthenticated(request, reply);

      const samlService = fastify.samlService;
      if (!samlService) {
        reply.status(503);
        return { error: "saml_not_configured" };
      }

      const params = z
        .object({ organizationId: z.string().min(1), connectionId: z.string().min(1) })
        .parse(request.params);

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const serviceClaims = buildServiceRoleClaims(params.organizationId);
      const existing = await getSamlConnectionById(serviceClaims, params.connectionId);

      if (!existing || existing.organizationId !== params.organizationId) {
        reply.status(404);
        return { error: "saml_connection_not_found" };
      }

      await deleteSamlConnection(serviceClaims, existing.id);

      await recordAuditEvent(serviceClaims, {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: params.organizationId,
        description: `SAML connection deleted (${existing.slug})`
      });

      reply.status(204);
      return null;
    }
  );

  fastify.get(
    "/audit",
    async (request, reply) => {
      ensureAuthenticated(request, reply);
      const query = z
        .object({
          organizationId: z.string().optional(),
          tenantId: z.string().optional(),
          productId: z.string().optional(),
          limit: z.coerce.number().int().positive().max(200).optional()
        })
        .parse(request.query);

      if (query.organizationId) {
        await requireOrgAdmin(query.organizationId, request.supabaseClaims!.sub);
      }

      const events = await listAuditEvents(buildServiceRoleClaims(query.organizationId), {
        organizationId: query.organizationId,
        tenantId: query.tenantId,
        productId: query.productId,
        limit: query.limit ?? 100
      });

      return { events };
    }
  );
};

export default adminRoutes;
