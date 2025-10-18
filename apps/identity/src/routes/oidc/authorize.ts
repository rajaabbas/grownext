import { URL } from "node:url";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims } from "@ma/core";
import { getProductByClientId, listEntitlementsForUser } from "@ma/db";

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional().default(""),
  state: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.enum(["S256", "plain"]).optional().default("S256"),
  tenant_id: z.string().optional(),
  nonce: z.string().optional()
});

const normalizeScopes = (requested: string, allowed: string[]): string => {
  const requestedScopes = requested
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  if (requestedScopes.length === 0) {
    return allowed.join(" ");
  }

  for (const scope of requestedScopes) {
    if (!allowed.includes(scope)) {
      throw new Error(`Unsupported scope: ${scope}`);
    }
  }

  return requestedScopes.join(" ");
};

const authorizeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: z.infer<typeof authorizeQuerySchema> }>(
    "/authorize",
    async (request, reply) => {
      const parsed = authorizeQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: "invalid_request", error_description: parsed.error.message };
      }

      const query = parsed.data;

      if (query.code_challenge_method !== "S256") {
        reply.status(400);
        return {
          error: "invalid_request",
          error_description: "code_challenge_method must be S256"
        };
      }

      if (!request.supabaseClaims?.sub) {
        reply.status(401);
        return {
          error: "login_required",
          error_description: "User must be authenticated via Supabase before authorizing"
        };
      }

      const product = await getProductByClientId(null, query.client_id);
      if (!product) {
        reply.status(400);
        return {
          error: "invalid_client",
          error_description: "Unknown client identifier"
        };
      }

      if (!product.redirectUris.includes(query.redirect_uri)) {
        reply.status(400);
        return {
          error: "invalid_request",
          error_description: "redirect_uri is not registered for this client"
        };
      }

      const entitlements = await listEntitlementsForUser(
        buildServiceRoleClaims(request.supabaseClaims.organization_id),
        request.supabaseClaims.sub
      );

      const now = Date.now();
      const matchingEntitlements = entitlements.filter(
        (ent) =>
          ent.productId === product.id &&
          (!ent.expiresAt || ent.expiresAt.getTime() >= now)
      );

      if (matchingEntitlements.length === 0) {
        reply.status(403);
        return {
          error: "access_denied",
          error_description: "User lacks active entitlements for this client"
        };
      }

      const selectedEntitlement = query.tenant_id
        ? matchingEntitlements.find((ent) => ent.tenantId === query.tenant_id)
        : matchingEntitlements[0];

      if (!selectedEntitlement) {
        reply.status(403);
        return {
          error: "access_denied",
          error_description: "User is not entitled to the requested tenant"
        };
      }

      const normalizedScope = normalizeScopes(query.scope ?? "", product.scopes ?? []);

      const entry = await fastify.authorizationCodes.create({
        userId: request.supabaseClaims.sub,
        clientId: product.clientId,
        productId: product.id,
        tenantId: selectedEntitlement.tenantId,
        organizationId: selectedEntitlement.organizationId,
        redirectUri: query.redirect_uri,
        scope: normalizedScope,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: "S256",
        sessionId: request.supabaseClaims.app_metadata?.session_id as string | undefined,
        nonce: query.nonce ?? null,
        roles: selectedEntitlement.roles,
        email: request.supabaseClaims.email ?? null
      });

      const redirectUrl = new URL(query.redirect_uri);
      redirectUrl.searchParams.set("code", entry.code);
      if (query.state) {
        redirectUrl.searchParams.set("state", query.state);
      }

      reply.header("Cache-Control", "no-store");
      reply.header("Pragma", "no-cache");
      reply.redirect(redirectUrl.toString());
    }
  );
};

export default authorizeRoute;
