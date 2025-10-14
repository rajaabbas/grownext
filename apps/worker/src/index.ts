import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { buildServiceRoleClaims, env, logger, QUEUES } from "@ma/core";
import { createTask } from "@ma/tasks-db";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const handleUserManagementJob = async (job: { name: string; data: any }) => {
  switch (job.name) {
    case "organization.invitation.created": {
      logger.info({ email: job.data.email }, "Simulating invitation delivery");
      break;
    }
    default: {
      logger.warn({ jobName: job.name }, "Unhandled user management job");
    }
  }
};

const handleIdentityEvent = async (job: { name: string; data: any }) => {
  switch (job.name) {
    case "tenant.created": {
      const { organizationId, tenantId, createdBy } = job.data ?? {};
      if (!organizationId || !tenantId || !createdBy) {
        logger.warn({ job }, "Tenant created event missing required fields");
        return;
      }

      await createTask(buildServiceRoleClaims(organizationId), {
        organizationId,
        tenantId,
        title: "Set up your workspace",
        description: "Invite your team and configure product access for this tenant.",
        createdById: createdBy
      });

      logger.info({ organizationId, tenantId }, "Provisioned onboarding task for new tenant");
      break;
    }
    case "organization.created": {
      logger.info({ organizationId: job.data?.organizationId }, "Organization created event received");
      break;
    }
    case "entitlement.granted": {
      logger.info({ entitlement: job.data }, "Entitlement granted event acknowledged");
      break;
    }
    default: {
      logger.warn({ jobName: job.name }, "Unhandled identity event");
    }
  }
};

const workers = [
  new Worker(QUEUES.USER_MANAGEMENT, handleUserManagementJob, { connection }),
  new Worker(QUEUES.IDENTITY_EVENTS, handleIdentityEvent, { connection })
];

const queueEvents = [
  new QueueEvents(QUEUES.USER_MANAGEMENT, { connection }),
  new QueueEvents(QUEUES.IDENTITY_EVENTS, { connection })
];

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
