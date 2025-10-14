import { createHash, randomBytes } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createOrganizationWithOwner,
  listOrganizationMembers,
  listTenants,
  createTenant,
  createOrganizationInvitation,
  getOrganizationMember,
  grantEntitlement,
  recordAuditEvent,
  listAuditEvents,
  withAuthorizationTransaction
} from "@ma/db";
import type { ProductRole, TenantRole, AuditEventType } from "@ma/db";
import { buildServiceRoleClaims } from "@ma/core";

const PRODUCT_ROLE_VALUES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "ANALYST",
  "CONTRIBUTOR"
] as const satisfies readonly ProductRole[];

const TENANT_ROLE_VALUES = ["ADMIN", "MEMBER", "VIEWER"] as const satisfies readonly TenantRole[];

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
    const error = new Error("forbidden");
    (error as any).statusCode = 403;
    throw error;
  }
};

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

      const { organization, defaultTenant } = await createOrganizationWithOwner({
        name: parsed.data.name,
        slug: parsed.data.slug,
        defaultTenantName: parsed.data.defaultTenantName,
        owner: {
          userId: request.supabaseClaims!.sub,
          email: request.supabaseClaims!.email ?? "",
          fullName: (request.supabaseClaims!.user_metadata?.full_name as string | undefined) ?? "Owner"
        }
      });

      await recordAuditEvent(buildServiceRoleClaims(organization.id), {
        eventType: "ADMIN_ACTION" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: organization.id,
        tenantId: defaultTenant.id,
        description: "Organization created via admin endpoint"
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

      await requireOrgAdmin(params.organizationId, request.supabaseClaims!.sub);

      const [tenants, members] = await Promise.all([
        listTenants(buildServiceRoleClaims(params.organizationId), params.organizationId),
        listOrganizationMembers(buildServiceRoleClaims(params.organizationId), params.organizationId)
      ]);

      return {
        organizationId: params.organizationId,
        tenants,
        members
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

      reply.status(201);
      return result;
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
          roles: z.array(z.enum(PRODUCT_ROLE_VALUES)).nonempty(),
          expiresAt: z.string().datetime().optional()
        })
        .parse(request.body);

      await requireOrgAdmin(body.organizationId, request.supabaseClaims!.sub);

      const entitlement = await grantEntitlement(buildServiceRoleClaims(body.organizationId), {
        organizationId: body.organizationId,
        tenantId: params.tenantId,
        productId: body.productId,
        userId: body.userId,
        roles: body.roles as ProductRole[],
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
      });

      await recordAuditEvent(buildServiceRoleClaims(body.organizationId), {
        eventType: "ENTITLEMENT_GRANTED" as AuditEventType,
        actorUserId: request.supabaseClaims!.sub,
        organizationId: body.organizationId,
        tenantId: params.tenantId,
        productId: body.productId,
        description: `Entitlement granted to ${body.userId}`,
        metadata: { roles: body.roles }
      });

      reply.status(201);
      return entitlement;
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

      reply.status(201);
      return { invitation, token };
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
