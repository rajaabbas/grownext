import { HealthResponseSchema } from "@ma/contracts";
import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              time: { type: "string" },
              uptime: { type: "number" }
            }
          }
        }
      }
    },
    async () => {
      const payload = {
        status: "ok",
        time: new Date().toISOString(),
        uptime: process.uptime()
      };

      return HealthResponseSchema.parse(payload);
    }
  );
};

export default healthRoutes;
