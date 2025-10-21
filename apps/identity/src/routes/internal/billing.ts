import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, env } from "@ma/core";
import { recordBillingUsageEvents } from "@ma/db";

const usageEventSchema = z.object({
  organizationId: z.string().min(1),
  subscriptionId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  featureKey: z.string().min(1),
  quantity: z.number().finite(),
  unit: z.string().min(1),
  recordedAt: z.string().datetime().optional(),
  source: z
    .enum(["PORTAL", "TASKS", "ADMIN", "WORKER", "API"] as const)
    .default("API"),
  metadata: z.record(z.any()).nullable().optional()
});

const billingInternalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/usage/events", async (request, reply) => {
    if (!env.IDENTITY_BILLING_ENABLED) {
      reply.status(404);
      return { error: "billing_disabled" };
    }

    const body = z
      .object({ events: z.array(usageEventSchema).min(1) })
      .parse(request.body ?? {});

    let accepted = 0;

    for (const event of body.events) {
      const payload = {
        organizationId: event.organizationId,
        subscriptionId: event.subscriptionId ?? null,
        tenantId: event.tenantId ?? null,
        productId: event.productId ?? null,
        featureKey: event.featureKey,
        quantity: event.quantity,
        unit: event.unit,
        recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
        source: event.source,
        metadata: event.metadata ?? null
      };

      const result = await recordBillingUsageEvents(
        buildServiceRoleClaims(event.organizationId),
        [payload]
      );

      accepted += result;
    }

    reply.code(202);
    return { accepted };
  });
};

export default billingInternalRoutes;
