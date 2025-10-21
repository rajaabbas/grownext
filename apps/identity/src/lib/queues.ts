import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

export interface IdentityQueues {
  identityEvents: Queue;
  userManagement: Queue;
  superAdminBulkJobs: Queue;
  billingUsage: Queue;
  billingInvoice: Queue;
  billingPaymentSync: Queue;
  close: () => Promise<void>;
  emitIdentityEvent: (event: string, payload: Record<string, unknown>) => Promise<void>;
  emitUserManagementJob: (event: string, payload: Record<string, unknown>) => Promise<void>;
  emitSuperAdminBulkJob: (payload: Record<string, unknown>) => Promise<void>;
  emitBillingUsageJob: (name: string, payload: Record<string, unknown>) => Promise<void>;
  emitBillingInvoiceJob: (name: string, payload: Record<string, unknown>) => Promise<void>;
  emitBillingPaymentSyncJob: (name: string, payload: Record<string, unknown>) => Promise<void>;
  broadcastSuperAdminBulkJobStatus: (payload: Record<string, unknown>) => Promise<void>;
}

export const createIdentityQueues = (): IdentityQueues => {
  const connection = new RedisConstructor(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  const identityEvents = new Queue(QUEUES.IDENTITY_EVENTS, { connection });
  const userManagement = new Queue(QUEUES.USER_MANAGEMENT, { connection });
  const superAdminBulkJobs = new Queue(QUEUES.SUPER_ADMIN_BULK_JOBS, { connection });
  const billingUsage = new Queue(QUEUES.BILLING_USAGE, { connection });
  const billingInvoice = new Queue(QUEUES.BILLING_INVOICE, { connection });
  const billingPaymentSync = new Queue(QUEUES.BILLING_PAYMENT_SYNC, { connection });

  const emitIdentityEvent = async (event: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: identityEvents.name, event, payload }, "Enqueue identity event");
    await identityEvents.add(event, payload, { removeOnComplete: 100, removeOnFail: 50 });
  };

  const emitUserManagementJob = async (event: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: userManagement.name, event, payload }, "Enqueue user management job");
    await userManagement.add(event, payload, { removeOnComplete: 100, removeOnFail: 50 });
  };

  const emitSuperAdminBulkJob = async (payload: Record<string, unknown>) => {
    logger.debug({ queue: superAdminBulkJobs.name, payload }, "Enqueue super admin bulk job");
    await superAdminBulkJobs.add("process", payload, {
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 1
    });
  };

  const emitBillingUsageJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: billingUsage.name, name, payload }, "Enqueue billing usage job");
    await billingUsage.add(name, payload, { removeOnComplete: 50, removeOnFail: 50, attempts: 3 });
  };

  const emitBillingInvoiceJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: billingInvoice.name, name, payload }, "Enqueue billing invoice job");
    await billingInvoice.add(name, payload, { removeOnComplete: 50, removeOnFail: 50, attempts: 3 });
  };

  const emitBillingPaymentSyncJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug(
      { queue: billingPaymentSync.name, name, payload },
      "Enqueue billing payment sync job"
    );
    await billingPaymentSync.add(name, payload, { removeOnComplete: 50, removeOnFail: 50, attempts: 5 });
  };

  const broadcastSuperAdminBulkJobStatus = async (payload: Record<string, unknown>) => {
    const channel = "super-admin.bulk-job.status";
    logger.debug({ channel, payload }, "Publish bulk job status");
    await connection.publish(channel, JSON.stringify(payload));
  };

  const close = async () => {
    await Promise.all([
      identityEvents.close(),
      userManagement.close(),
      superAdminBulkJobs.close(),
      billingUsage.close(),
      billingInvoice.close(),
      billingPaymentSync.close()
    ]);
    await connection.quit();
  };

  const handleQueueError = (queue: Queue) => {
    queue.on("error", (error: Error) => {
      logger.error({ queue: queue.name, error }, "Queue error");
    });
  };

  handleQueueError(identityEvents);
  handleQueueError(userManagement);

  handleQueueError(superAdminBulkJobs);
  handleQueueError(billingUsage);
  handleQueueError(billingInvoice);
  handleQueueError(billingPaymentSync);

  return {
    identityEvents,
    userManagement,
    superAdminBulkJobs,
    billingUsage,
    billingInvoice,
    billingPaymentSync,
    emitIdentityEvent,
    emitUserManagementJob,
    emitSuperAdminBulkJob,
    emitBillingUsageJob,
    emitBillingInvoiceJob,
    emitBillingPaymentSyncJob,
    broadcastSuperAdminBulkJobStatus,
    close
  };
};
