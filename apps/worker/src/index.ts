import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const queueEvents = new QueueEvents(QUEUES.USER_MANAGEMENT, {
  connection
});

const worker = new Worker(
  QUEUES.USER_MANAGEMENT,
  async (job) => {
    logger.info({ jobName: job.name, data: job.data }, "User management job received");
  },
  { connection }
);

const start = async () => {
  await Promise.all([queueEvents.waitUntilReady(), worker.waitUntilReady()]);
  logger.info("Worker ready");

  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, result }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Job failed");
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, "Queue event failure reported");
  });

  queueEvents.on("error", (error) => {
    logger.error({ error }, "Queue events error");
  });
};

const shutdown = async () => {
  logger.info("Shutting down worker");
  await worker.close();
  await queueEvents.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  logger.error({ error }, "Worker failed to start");
  process.exit(1);
});
