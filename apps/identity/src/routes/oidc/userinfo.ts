import type { FastifyPluginAsync } from "fastify";

const userinfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/userinfo", async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.status(401);
      return { error: "invalid_token", error_description: "Missing bearer token" };
    }

    const token = header.slice("Bearer ".length).trim();

    try {
      const payload = await fastify.tokenService.verifyAccessToken(token);

      reply.header("Cache-Control", "no-store");
      reply.header("Pragma", "no-cache");

      return {
        sub: payload.sub,
        email: payload.email,
        tenant_id: payload.tenant_id,
        organization_id: payload.organization_id,
        product_id: payload.product_id,
        roles: payload.roles,
        scope: payload.scope
      };
    } catch (error) {
      request.log.warn({ error }, "Failed to verify access token");
      reply.status(401);
      return { error: "invalid_token", error_description: "Access token is invalid" };
    }
  });
};

export default userinfoRoute;
