import type { FastifyPluginAsync } from "fastify";

export const jwksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/jwks", async (request, reply) => {
    try {
      const jwks = await fastify.tokenService.getJwks();
      reply.header("Cache-Control", "public, max-age=86400");
      return jwks;
    } catch (error) {
      request.log.warn({ error }, "JWKS request failed");
      reply.status(503);
      return { error: "jwks_unavailable" };
    }
  });
};

export const wellKnownJwksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/jwks.json", async (request, reply) => {
    try {
      const jwks = await fastify.tokenService.getJwks();
      reply.header("Cache-Control", "public, max-age=86400");
      return jwks;
    } catch (error) {
      request.log.warn({ error }, "JWKS request failed");
      reply.status(503);
      return { error: "jwks_unavailable" };
    }
  });
};
