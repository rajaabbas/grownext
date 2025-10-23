import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import type { JobsOptions } from "bullmq";
import { createHash } from "node:crypto";
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

  const createJobId = (prefix: string, parts: Array<unknown>): string | undefined => {
    const serialized = parts
      .map((part) => {
        if (part === undefined || part === null) {
          return "";
        }
        if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
          return String(part);
        }
        try {
          return JSON.stringify(part);
        } catch {
          return "";
        }
      })
      .filter((segment) => segment.length > 0)
      .join("|");

    if (!serialized) {
      return undefined;
    }

    const digest = createHash("sha1").update(serialized).digest("hex");
    return `${prefix}:${digest}`;
  };

  const applyJobOptions = (base: JobsOptions, jobId?: string): JobsOptions => {
    return jobId ? { ...base, jobId } : { ...base };
  };

  const emitBillingUsageJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: billingUsage.name, name, payload }, "Enqueue billing usage job");
    const jobId = createJobId("billing-usage", [
      payload.organizationId,
      payload.subscriptionId,
      payload.periodStart,
      payload.periodEnd,
      payload.resolution,
      payload.featureKeys
    ]);

    await billingUsage.add(
      name,
      payload,
      applyJobOptions(
        {
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 }
        },
        jobId
      )
    );
  };

  const emitBillingInvoiceJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: billingInvoice.name, name, payload }, "Enqueue billing invoice job");
    const jobId = createJobId("billing-invoice", [
      payload.organizationId,
      payload.subscriptionId,
      payload.periodStart,
      payload.periodEnd,
      payload.invoiceNumber
    ]);

    await billingInvoice.add(
      name,
      payload,
      applyJobOptions(
        {
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 }
        },
        jobId
      )
    );
  };

  const emitBillingPaymentSyncJob = async (name: string, payload: Record<string, unknown>) => {
    logger.debug(
      { queue: billingPaymentSync.name, name, payload },
      "Enqueue billing payment sync job"
    );
    const stripeEventId =
      typeof payload.metadata === "object" && payload.metadata !== null
        ? (payload.metadata as Record<string, unknown>).stripeEventId
        : undefined;
    const jobId = createJobId("billing-payment-sync", [
      payload.organizationId,
      payload.invoiceId,
      payload.event,
      payload.externalPaymentId,
      stripeEventId
    ]);

    await billingPaymentSync.add(
      name,
      payload,
      applyJobOptions(
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 }
        },
        jobId
      )
    );
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
