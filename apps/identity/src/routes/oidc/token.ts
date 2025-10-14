import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env, buildServiceRoleClaims } from "@ma/core";
import {
  getProductByClientId,
  listEntitlementsForUser,
  recordAuditEvent
} from "@ma/db";
import type { AuditEventType } from "@ma/db";

const tokenBodySchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"]),
  code: z.string().optional(),
  code_verifier: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  refresh_token: z.string().optional()
});

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

const REFRESH_COOKIE_NAME = "gn_platform_refresh";

const tokenRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof tokenBodySchema> }>("/token", async (request, reply) => {
    const parsed = tokenBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: "invalid_request", error_description: parsed.error.message };
    }

    const body = parsed.data;

    const product = await getProductByClientId(null, body.client_id);
    if (!product) {
      reply.status(400);
      return { error: "invalid_client", error_description: "Unknown client identifier" };
    }

    if (product.clientSecretHash && (!body.client_secret || hashSecret(body.client_secret) !== product.clientSecretHash)) {
      reply.status(401);
      return { error: "invalid_client", error_description: "Client secret is invalid" };
    }

    if (body.grant_type === "authorization_code") {
      if (!body.code || !body.code_verifier || !body.redirect_uri) {
        reply.status(400);
        return {
          error: "invalid_request",
          error_description: "code, code_verifier, and redirect_uri are required for authorization_code grants"
        };
      }

      const entry = fastify.authorizationCodes.consume(body.code);
      if (!entry) {
        reply.status(400);
        return { error: "invalid_grant", error_description: "Authorization code is invalid or expired" };
      }

      if (entry.clientId !== product.clientId || entry.redirectUri !== body.redirect_uri) {
        reply.status(400);
        return { error: "invalid_grant", error_description: "Authorization code details mismatch" };
      }

      const computedChallenge = createHash("sha256").update(body.code_verifier).digest("base64url");
      if (computedChallenge !== entry.codeChallenge) {
        reply.status(400);
        return { error: "invalid_grant", error_description: "Invalid code_verifier" };
      }

      const userAgent = Array.isArray(request.headers["user-agent"])
        ? request.headers["user-agent"][0]
        : request.headers["user-agent"];

      const tokenSet = await fastify.tokenService.issueTokenSet(
        {
          userId: entry.userId,
          clientId: entry.clientId,
          productId: entry.productId,
          tenantId: entry.tenantId,
          organizationId: entry.organizationId,
          scope: entry.scope,
          roles: entry.roles,
          sessionId: entry.sessionId ?? undefined,
          email: entry.email ?? undefined,
          nonce: entry.nonce ?? null
        },
        {
          metadata: {
            ipAddress: request.ip,
            userAgent: userAgent ?? null,
            description: `OIDC code exchange for ${entry.clientId}`
          }
        }
      );

      await recordAuditEvent(buildServiceRoleClaims(entry.organizationId), {
        eventType: "TOKEN_ISSUED" as AuditEventType,
        actorUserId: entry.userId,
        organizationId: entry.organizationId,
        tenantId: entry.tenantId,
        productId: entry.productId,
        description: "Authorization code exchanged for tokens",
        ipAddress: request.ip,
        userAgent: userAgent ?? undefined,
        metadata: { clientId: entry.clientId, scope: entry.scope }
      });

      reply
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .setCookie(REFRESH_COOKIE_NAME, tokenSet.refreshToken, {
          domain: env.IDENTITY_COOKIE_DOMAIN,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: env.NODE_ENV === "production",
          maxAge: env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS
        });

      return {
        token_type: tokenSet.tokenType,
        expires_in: tokenSet.expiresIn,
        access_token: tokenSet.accessToken,
        refresh_token: tokenSet.refreshToken,
        id_token: tokenSet.idToken,
        scope: entry.scope
      };
    }

    if (!body.refresh_token) {
      reply.status(400);
      return { error: "invalid_request", error_description: "refresh_token is required" };
    }

    const existing = await fastify.tokenService.validateRefreshToken(body.refresh_token, product.clientId);
    if (!existing) {
      reply.status(400);
      return { error: "invalid_grant", error_description: "Refresh token is invalid or expired" };
    }

    const entitlements = await listEntitlementsForUser(
      buildServiceRoleClaims(undefined),
      existing.userId
    );
    const entitlement = entitlements.find(
      (ent) => ent.productId === (existing.productId ?? product.id) && ent.tenantId === existing.tenantId
    );

    if (!entitlement) {
      reply.status(403);
      return {
        error: "access_denied",
        error_description: "User no longer has access to this product"
      };
    }

    const defaultScope = (product.scopes ?? []).join(" ");
    const scope = existing.scope ?? defaultScope;

    const refreshUserAgent = Array.isArray(request.headers["user-agent"])
      ? request.headers["user-agent"][0]
      : request.headers["user-agent"];

    const tokenSet = await fastify.tokenService.issueTokenSet(
      {
        userId: existing.userId,
        clientId: product.clientId,
        productId: entitlement.productId,
        tenantId: entitlement.tenantId,
        organizationId: entitlement.organizationId,
        scope,
        roles: entitlement.roles,
        sessionId: existing.sessionId ?? undefined
      },
      {
        existingRefreshToken: body.refresh_token,
        metadata: {
          ipAddress: request.ip,
          userAgent: refreshUserAgent ?? null,
          description: `OIDC refresh for ${product.clientId}`
        }
      }
    );

    await recordAuditEvent(buildServiceRoleClaims(entitlement.organizationId), {
      eventType: "TOKEN_REFRESHED" as AuditEventType,
      actorUserId: existing.userId,
      organizationId: entitlement.organizationId,
      tenantId: entitlement.tenantId,
      productId: entitlement.productId,
      description: "Refresh token exchanged for new tokens",
      ipAddress: request.ip,
      userAgent: refreshUserAgent ?? undefined,
      metadata: { clientId: product.clientId, scope }
    });

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .setCookie(REFRESH_COOKIE_NAME, tokenSet.refreshToken, {
        domain: env.IDENTITY_COOKIE_DOMAIN,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
        maxAge: env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS
      });

    return {
      token_type: tokenSet.tokenType,
      expires_in: tokenSet.expiresIn,
      access_token: tokenSet.accessToken,
      refresh_token: tokenSet.refreshToken,
      id_token: tokenSet.idToken,
      scope
    };
  });
};

export default tokenRoute;
