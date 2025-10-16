import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getSamlConnectionBySlug,
  findSamlAccount,
  linkSamlAccount,
  findUserProfileByEmail,
  getOrganizationMember,
  recordAuditEvent
} from "@ma/db";
import type { AuditEventType } from "@ma/db";
import { buildServiceRoleClaims } from "@ma/core";

const slugParamSchema = z.object({ slug: z.string().min(1) });
const loginQuerySchema = z.object({ relayState: z.string().optional() });
const acsBodySchema = z.object({
  SAMLResponse: z.string().min(1),
  RelayState: z.string().optional()
});

const EMAIL_ATTRIBUTE_CANDIDATES = [
  "email",
  "mail",
  "Email",
  "user.email",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
];

const resolveEmailFromAttributes = (attributes: Record<string, string | string[]>): string | null => {
  for (const key of EMAIL_ATTRIBUTE_CANDIDATES) {
    const value = attributes[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === "string" && entry.includes("@"));
      if (first) return first;
    } else if (typeof value === "string" && value.includes("@")) {
      return value;
    }
  }
  return null;
};

const samlRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/:slug/metadata", async (request, reply) => {
    if (!fastify.samlService) {
      reply.status(503);
      return "SAML is not configured";
    }

    const params = slugParamSchema.parse(request.params);
    const connection = await getSamlConnectionBySlug(buildServiceRoleClaims(undefined), params.slug);

    if (!connection || !connection.enabled) {
      reply.status(404);
      return "SAML connection not found";
    }

    const metadata = fastify.samlService.generateServiceProviderMetadata(connection);
    reply.header("Content-Type", "application/samlmetadata+xml");
    reply.header("Cache-Control", "no-store");
    return metadata;
  });

  fastify.get("/:slug/login", async (request, reply) => {
    if (!fastify.samlService) {
      reply.status(503);
      return { error: "saml_not_configured" };
    }

    const params = slugParamSchema.parse(request.params);
    const query = loginQuerySchema.parse(request.query);

    const connection = await getSamlConnectionBySlug(buildServiceRoleClaims(undefined), params.slug);

    if (!connection || !connection.enabled) {
      reply.status(404);
      return { error: "saml_connection_not_found" };
    }

    try {
      const authn = fastify.samlService.createAuthnRequest(connection, query.relayState ?? null);
      reply.header("Cache-Control", "no-store");
      reply.redirect(authn.redirectUrl, 302);
      return undefined;
    } catch (error) {
      request.log.error({ error }, "Failed to initiate SAML login request");
      reply.status(500);
      return { error: "saml_login_request_failed" };
    }
  });

  fastify.post("/:slug/acs", async (request, reply) => {
    if (!fastify.samlService) {
      reply.status(503);
      return { error: "saml_not_configured" };
    }

    const params = slugParamSchema.parse(request.params);
    const body = acsBodySchema.safeParse(request.body);

    if (!body.success) {
      reply.status(400);
      return { error: "invalid_request" };
    }

    const connection = await getSamlConnectionBySlug(buildServiceRoleClaims(undefined), params.slug);

    if (!connection || !connection.enabled) {
      reply.status(404);
      return { error: "saml_connection_not_found" };
    }

    let assertion;
    try {
      assertion = await fastify.samlService.validatePostAssertion(
        connection,
        body.data.SAMLResponse,
        body.data.RelayState ?? null
      );
    } catch (error) {
      request.log.warn({ error }, "Invalid SAML response");
      reply.status(400);
      return { error: "invalid_saml_response" };
    }

    const attributes = assertion.attributes;
    const email = resolveEmailFromAttributes(attributes);

    const serviceClaims = buildServiceRoleClaims(connection.organizationId);
    const existingAccount = await findSamlAccount(serviceClaims, connection.id, assertion.nameId);

    let userId: string | null = existingAccount?.userId ?? null;

    if (!userId) {
      if (!email) {
        reply.status(404);
        return { error: "user_lookup_failed", detail: "Email attribute missing for new mapping" };
      }

      const profile = await findUserProfileByEmail(serviceClaims, email);

      if (!profile) {
        reply.status(404);
        return { error: "user_not_found" };
      }

      userId = profile.userId;

      await linkSamlAccount(serviceClaims, {
        samlConnectionId: connection.id,
        userId,
        nameId: assertion.nameId,
        email,
        attributes
      });
    }

    const membership = await getOrganizationMember(
      buildServiceRoleClaims(connection.organizationId),
      connection.organizationId,
      userId
    );

    if (!membership) {
      reply.status(403);
      return { error: "user_not_in_organization" };
    }

    await recordAuditEvent(serviceClaims, {
      eventType: "SIGN_IN" as AuditEventType,
      actorUserId: userId,
      organizationId: connection.organizationId,
      description: `SAML assertion accepted for ${connection.slug}`,
      metadata: {
        samlConnectionId: connection.id,
        nameId: assertion.nameId,
        issuer: assertion.issuer,
        audience: assertion.audience ?? null
      }
    });

    reply.header("Cache-Control", "no-store");
    return {
      status: "assertion_validated",
      organizationId: connection.organizationId,
      userId,
      samlConnectionId: connection.id,
      relayState: body.data.RelayState ?? null,
      attributes,
      sessionIndex: assertion.sessionIndex ?? null
    };
  });
};

export default samlRoutes;
