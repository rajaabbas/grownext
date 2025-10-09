import { VersionResponseSchema } from "@ma/contracts";
import { env } from "@ma/core";
import type { FastifyPluginAsync } from "fastify";

const versionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/version", async () => {
    return VersionResponseSchema.parse({
      version: env.APP_VERSION
    });
  });
};

export default versionRoutes;
