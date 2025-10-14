import { userManagementQueue, identityEventsQueue, closeQueues } from "./queue";
import { logger } from "@ma/core";

const run = async () => {
  const targetQueue = process.env.ENQUEUE_QUEUE === "identity" ? identityEventsQueue : userManagementQueue;
  const event = process.env.ENQUEUE_EVENT ?? "manual-test";

  const payload = targetQueue === userManagementQueue
    ? {
        email: process.env.ENQUEUE_EMAIL ?? "user@example.com",
        triggeredAt: new Date().toISOString()
      }
    : {
        type: process.env.IDENTITY_EVENT_TYPE ?? "tenant.provisioned",
        organizationId: process.env.IDENTITY_ORG_ID ?? "org-1",
        triggeredAt: new Date().toISOString()
      };

  const job = await targetQueue.add(event, {
    ...payload,
    triggeredAt: new Date().toISOString()
  });

  logger.info({ jobId: job.id, event, queue: targetQueue.name }, "Enqueued job");
};

run()
  .catch((error) => {
    logger.error({ error }, "Failed to enqueue job");
    process.exit(1);
  })
  .finally(async () => {
    await closeQueues();
    process.exit(0);
  });
