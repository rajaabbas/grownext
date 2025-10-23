import type { FastifyPluginAsync } from "fastify";

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser(
    /^application\/json(?:;.*)?$/,
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    }
  );

  fastify.post("/stripe", async (request, reply) => {
    const handler = fastify.paymentProvider.handleWebhook;

    if (!handler) {
      fastify.log.warn("Received Stripe webhook but no payment provider is configured");
      reply.code(202);
      return { received: true };
    }

    const signatureHeader = request.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawBody = typeof request.body === "string" ? request.body : "";

    try {
      await handler({
        rawBody,
        signature,
        emitPaymentSyncJob: fastify.queues.emitBillingPaymentSyncJob
      });
      reply.code(200);
      return { received: true };
    } catch (error) {
      fastify.log.error({ error }, "Failed to process Stripe webhook");
      reply.code(400);
      return { error: "invalid_webhook" };
    }
  });
};

export default webhookRoutes;
