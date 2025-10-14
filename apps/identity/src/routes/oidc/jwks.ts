import type { FastifyPluginAsync } from "fastify";

export const jwksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/jwks", async (_request, reply) => {
    const jwks = await fastify.tokenService.getJwks();
    reply.header("Cache-Control", "public, max-age=86400");
    return jwks;
  });
};

export const wellKnownJwksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/jwks.json", async (_request, reply) => {
    const jwks = await fastify.tokenService.getJwks();
    reply.header("Cache-Control", "public, max-age=86400");
    return jwks;
  });
};
