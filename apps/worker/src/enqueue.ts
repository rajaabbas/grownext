import { userManagementQueue, closeUserManagementQueue } from "./queue";
import { logger } from "@ma/core";

const run = async () => {
  const email = process.env.ENQUEUE_EMAIL ?? "user@example.com";
  const event = process.env.ENQUEUE_EVENT ?? "manual-test";

  const job = await userManagementQueue.add(event, {
    email,
    triggeredAt: new Date().toISOString()
  });

  logger.info({ jobId: job.id, event, email }, "Enqueued user management job");
};

run()
  .catch((error) => {
    logger.error({ error }, "Failed to enqueue job");
    process.exit(1);
  })
  .finally(async () => {
    await closeUserManagementQueue();
    process.exit(0);
  });
