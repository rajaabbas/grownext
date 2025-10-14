import type { FastifyPluginAsync } from "fastify";
import { buildServiceRoleClaims } from "@ma/core";
import {
  getOrganizationById,
  listEntitlementsForUser,
  listRefreshTokensForUser,
  listTenantSummariesForOrganization,
  upsertUserProfile,
  findRefreshTokenById,
  revokeRefreshTokenById,
  recordAuditEvent
} from "@ma/db";
import type { AuditEventType } from "@ma/db";
import { PortalLauncherResponseSchema } from "@ma/contracts";
import { env } from "@ma/core";

const resolveOrganizationId = (claims: Record<string, unknown> | null | undefined): string | null => {
  if (!claims) {
    return null;
  }

  const direct = claims.organization_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const appMetadataOrg = claims.app_metadata && (claims.app_metadata as Record<string, unknown>).organization_id;
  if (typeof appMetadataOrg === "string" && appMetadataOrg.length > 0) {
    return appMetadataOrg;
  }

  const userMetadataOrg =
    claims.user_metadata && (claims.user_metadata as Record<string, unknown>).organization_id;
  if (typeof userMetadataOrg === "string" && userMetadataOrg.length > 0) {
    return userMetadataOrg;
  }

  return null;
};

const resolveLaunchUrl = (options: {
  launcherUrl: string | null;
  postLogoutRedirectUris: string[];
  redirectUris: string[];
}): string => {
  if (options.launcherUrl) return options.launcherUrl;
  if (options.postLogoutRedirectUris.length > 0) return options.postLogoutRedirectUris[0]!;
  if (options.redirectUris.length > 0) {
    const uri = options.redirectUris[0]!;
    try {
      const parsed = new URL(uri);
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return uri;
    }
  }
  return env.APP_BASE_URL;
};

const portalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/launcher", async (request, reply) => {
    const claims = request.supabaseClaims;

    if (!claims?.sub) {
      reply.status(401);
      return { error: "not_authenticated" };
    }

    const organizationId = resolveOrganizationId(claims);
    if (!organizationId) {
      request.log.warn({ userId: claims.sub }, "Missing organization context on claims");
      reply.status(400);
      return { error: "organization_context_missing" };
    }

    const fullName =
      (claims.user_metadata?.full_name as string | undefined)?.trim() ??
      (claims.app_metadata?.full_name as string | undefined)?.trim() ??
      claims.email ??
      "User";

    const profile = await upsertUserProfile(buildServiceRoleClaims(organizationId), {
      userId: claims.sub,
      email: claims.email ?? `${claims.sub}@example.com`,
      fullName
    });

    const [organization, entitlements, tenantSummaries, refreshTokens] = await Promise.all([
      getOrganizationById(buildServiceRoleClaims(organizationId), organizationId),
      listEntitlementsForUser(buildServiceRoleClaims(organizationId), claims.sub),
      listTenantSummariesForOrganization(buildServiceRoleClaims(organizationId), organizationId),
      listRefreshTokensForUser(buildServiceRoleClaims(undefined), claims.sub)
    ]);

    if (!organization) {
      reply.status(404);
      return { error: "organization_not_found" };
    }

    const tenantNameMap = new Map<string, string | null>();
    for (const tenant of tenantSummaries) {
      tenantNameMap.set(tenant.id, tenant.name);
    }

    const productsById = new Map<
      string,
      {
        productId: string;
        productSlug: string;
        name: string;
        description: string | null;
        iconUrl: string | null;
        launchUrl: string;
        roles: Set<string>;
        lastUsedAt: string | null;
      }
    >();

    for (const entitlement of entitlements) {
      const existing = productsById.get(entitlement.productId);
      const productLaunchUrl = resolveLaunchUrl({
        launcherUrl: entitlement.product.launcherUrl,
        postLogoutRedirectUris: entitlement.product.postLogoutRedirectUris,
        redirectUris: entitlement.product.redirectUris
      });

      if (!existing) {
        productsById.set(entitlement.productId, {
          productId: entitlement.productId,
          productSlug: entitlement.product.slug,
          name: entitlement.product.name,
          description: entitlement.product.description,
          iconUrl: entitlement.product.iconUrl,
          launchUrl: productLaunchUrl,
          roles: new Set(entitlement.roles),
          lastUsedAt: null
        });
      } else {
        entitlement.roles.forEach((role) => existing.roles.add(role));
      }
    }

    const activeTokens = refreshTokens.filter((token) => token.revokedAt === null);

    for (const token of activeTokens) {
      if (!token.productId) continue;
      const product = productsById.get(token.productId);
      if (!product) continue;
      if (!product.lastUsedAt || new Date(token.createdAt).getTime() > new Date(product.lastUsedAt).getTime()) {
        product.lastUsedAt = token.createdAt.toISOString();
      }
    }

    const response = {
      user: {
        id: profile.userId,
        email: profile.email,
        fullName: profile.fullName,
        organizationId: organization.id,
        organizationName: organization.name,
        entitlements: entitlements.map((ent) => ({
          productId: ent.productId,
          productSlug: ent.product.slug,
          productName: ent.product.name,
          tenantId: ent.tenantId,
          tenantName: tenantNameMap.get(ent.tenantId) ?? null,
          roles: ent.roles
        }))
      },
      tenants: tenantSummaries.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description,
        membersCount: tenant.membersCount,
        productsCount: tenant.productsCount
      })),
      products: Array.from(productsById.values()).map((product) => ({
        productId: product.productId,
        productSlug: product.productSlug,
        name: product.name,
        description: product.description,
        iconUrl: product.iconUrl,
        launchUrl: product.launchUrl,
        roles: Array.from(product.roles.values()),
        lastUsedAt: product.lastUsedAt
      })),
      sessions: activeTokens.map((token) => ({
        id: token.id,
        createdAt: token.createdAt.toISOString(),
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
        description: token.description,
        productId: token.productId,
        tenantId: token.tenantId,
        revokedAt: token.revokedAt ? token.revokedAt.toISOString() : null
      }))
    };

    reply.header("Cache-Control", "no-store");
    reply.header("Pragma", "no-cache");

    return PortalLauncherResponseSchema.parse(response);
  });

  fastify.delete<{ Params: { sessionId: string } }>("/sessions/:sessionId", async (request, reply) => {
    const claims = request.supabaseClaims;

    if (!claims?.sub) {
      reply.status(401);
      return { error: "not_authenticated" };
    }

    const sessionId = request.params.sessionId;
    const tokenRecord = await findRefreshTokenById(buildServiceRoleClaims(undefined), sessionId);

    if (!tokenRecord) {
      reply.status(404);
      return { error: "session_not_found" };
    }

    if (tokenRecord.userId !== claims.sub) {
      reply.status(403);
      return { error: "forbidden" };
    }

    if (tokenRecord.revokedAt) {
      reply.status(204);
      return null;
    }

    await revokeRefreshTokenById(buildServiceRoleClaims(undefined), tokenRecord.id);

    if (tokenRecord.sessionId) {
      await fastify.tokenService.rotateSession(tokenRecord.sessionId);
    }

    const organizationId = resolveOrganizationId(claims);

    await recordAuditEvent(buildServiceRoleClaims(organizationId ?? undefined), {
      eventType: "TOKEN_REVOKED" as AuditEventType,
      actorUserId: claims.sub,
      organizationId: organizationId ?? null,
      tenantId: tokenRecord.tenantId ?? null,
      productId: tokenRecord.productId ?? null,
      description: "User revoked refresh token",
      ipAddress: request.ip,
      metadata: {
        sessionId: tokenRecord.sessionId,
        refreshTokenId: tokenRecord.id
      }
    });

    reply.status(204);
    return null;
  });
};

export default portalRoutes;
