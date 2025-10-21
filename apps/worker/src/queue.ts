import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const userManagementQueue = new Queue(QUEUES.USER_MANAGEMENT, { connection });
export const identityEventsQueue = new Queue(QUEUES.IDENTITY_EVENTS, { connection });
export const taskNotificationsQueue = new Queue(QUEUES.TASK_NOTIFICATIONS, { connection });
export const superAdminBulkQueue = new Queue(QUEUES.SUPER_ADMIN_BULK_JOBS, { connection });
export const billingUsageQueue = new Queue(QUEUES.BILLING_USAGE, { connection });
export const billingInvoiceQueue = new Queue(QUEUES.BILLING_INVOICE, { connection });
export const billingPaymentSyncQueue = new Queue(QUEUES.BILLING_PAYMENT_SYNC, { connection });

const queues = [
  userManagementQueue,
  identityEventsQueue,
  taskNotificationsQueue,
  superAdminBulkQueue,
  billingUsageQueue,
  billingInvoiceQueue,
  billingPaymentSyncQueue
];

for (const queue of queues) {
  queue.on("error", (error) => {
    logger.error({ error, queue: queue.name }, "Queue error");
  });
}

export const closeQueues = async () => {
  await Promise.all(queues.map((queue) => queue.close()));
  await connection.quit();
};
