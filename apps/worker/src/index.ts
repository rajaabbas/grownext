import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const definitions = [
  {
    name: QUEUES.USER_MANAGEMENT,
    processor: async (job: { name: string; data: unknown }) => {
      logger.info({ jobName: job.name, data: job.data }, "User management job received");
    }
  },
  {
    name: QUEUES.IDENTITY_EVENTS,
    processor: async (job: { name: string; data: unknown }) => {
      logger.info({ jobName: job.name, data: job.data }, "Identity event processed");
    }
  }
] as const;

const workers = definitions.map((definition) =>
  new Worker(definition.name, definition.processor, { connection })
);
const queueEvents = definitions.map((definition) => new QueueEvents(definition.name, { connection }));

const start = async () => {
  await Promise.all([
    ...workers.map((worker) => worker.waitUntilReady()),
    ...queueEvents.map((event) => event.waitUntilReady())
  ]);
  logger.info("Workers ready");

  for (const worker of workers) {
    worker.on("completed", (job, result) => {
      logger.info({ queue: worker.name, jobId: job.id, result }, "Job completed");
    });

    worker.on("failed", (job, error) => {
      logger.error({ queue: worker.name, jobId: job?.id, error }, "Job failed");
    });
  }

  for (const events of queueEvents) {
    events.on("failed", ({ jobId, failedReason }) => {
      logger.error({ queue: events.name, jobId, failedReason }, "Queue event failure reported");
    });

    events.on("error", (error) => {
      logger.error({ queue: events.name, error }, "Queue events error");
    });
  }
};

const shutdown = async () => {
  logger.info("Shutting down workers");
  await Promise.all([...workers.map((worker) => worker.close()), ...queueEvents.map((event) => event.close())]);
  await connection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  logger.error({ error }, "Worker failed to start");
  process.exit(1);
});
