import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { buildServiceRoleClaims, env } from "@ma/core";
import {
  getActiveBillingSubscriptionForOrganization,
  recordBillingUsageEvents,
  type RecordBillingUsageEventInput
} from "@ma/db";

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
  metadata: z.record(z.any()).nullable().optional(),
  fingerprint: z.string().min(1).optional()
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

    const eventsByOrganization = new Map<
      string,
      {
        claims: ReturnType<typeof buildServiceRoleClaims>;
        subscriptionId: string | null;
        events: RecordBillingUsageEventInput[];
      }
    >();

    const orgsNeedingSubscriptionLookup = new Set<string>();

    for (const event of body.events) {
      if (!eventsByOrganization.has(event.organizationId)) {
        eventsByOrganization.set(event.organizationId, {
          claims: buildServiceRoleClaims(event.organizationId),
          subscriptionId: null,
          events: [] as RecordBillingUsageEventInput[]
        });
      }

      if (!event.subscriptionId) {
        orgsNeedingSubscriptionLookup.add(event.organizationId);
      }
    }

    for (const organizationId of orgsNeedingSubscriptionLookup) {
      const context = eventsByOrganization.get(organizationId);
      if (!context) continue;

      try {
        const subscription = await getActiveBillingSubscriptionForOrganization(
          context.claims,
          organizationId
        );
        context.subscriptionId = subscription?.id ?? null;
      } catch (error) {
        fastify.log.error(
          { error, organizationId },
          "Failed to resolve active billing subscription for usage event"
        );
        context.subscriptionId = null;
      }
    }

    let attempted = 0;
    let accepted = 0;

    for (const event of body.events) {
      const context = eventsByOrganization.get(event.organizationId);

      if (!context) {
        // Should never happen because we seed entries above, but guard to avoid runtime failures.
        continue;
      }

      const payload = {
        organizationId: event.organizationId,
        subscriptionId: event.subscriptionId ?? context.subscriptionId ?? null,
        tenantId: event.tenantId ?? null,
        productId: event.productId ?? null,
        featureKey: event.featureKey,
        quantity: event.quantity,
        unit: event.unit,
        recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
        source: event.source,
        metadata: event.metadata ?? null,
        fingerprint: event.fingerprint ?? null
      };

      context.events.push(payload);
      attempted += 1;
    }

    for (const [organizationId, entry] of eventsByOrganization.entries()) {
      if (entry.events.length === 0) {
        continue;
      }

      try {
        const result = await recordBillingUsageEvents(entry.claims, entry.events);
        accepted += result;
      } catch (error) {
        fastify.log.error(
          { error, organizationId, events: entry.events.length },
          "Failed to record billing usage events"
        );
      }
    }

    if (accepted < attempted) {
      fastify.log.warn(
        {
          attempted,
          accepted,
          dropped: attempted - accepted
        },
        "billing_usage_event_drop"
      );
    }

    reply.code(202);
    return { accepted };
  });
};

export default billingInternalRoutes;
