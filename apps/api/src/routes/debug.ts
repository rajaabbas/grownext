import { env } from "@ma/core";
import type { FastifyPluginAsync } from "fastify";

const debugRoutes: FastifyPluginAsync = async (fastify) => {
  if (env.NODE_ENV !== "production") {
    fastify.get("/debug/claims", async (request) => {
      return {
        claims: request.supabaseClaims,
        headers: request.headers
      };
    });
  }
};

export default debugRoutes;
