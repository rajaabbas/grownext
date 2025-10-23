import {
  userManagementQueue,
  identityEventsQueue,
  billingUsageQueue,
  billingInvoiceQueue,
  billingPaymentSyncQueue,
  closeQueues
} from "./queue";
import { logger } from "@ma/core";

type SupportedQueue =
  | "user-management"
  | "identity"
  | "billing-usage"
  | "billing-invoice"
  | "billing-payment";

const resolveQueue = (name: SupportedQueue) => {
  switch (name) {
    case "identity":
      return identityEventsQueue;
    case "billing-usage":
      return billingUsageQueue;
    case "billing-invoice":
      return billingInvoiceQueue;
    case "billing-payment":
      return billingPaymentSyncQueue;
    case "user-management":
    default:
      return userManagementQueue;
  }
};

const run = async () => {
  const requestedQueue = (process.env.ENQUEUE_QUEUE ?? "user-management") as SupportedQueue;
  const targetQueue = resolveQueue(requestedQueue);
  const event = process.env.ENQUEUE_EVENT ?? "manual-test";
  const jobId = process.env.ENQUEUE_JOB_ID ?? undefined;

  let payload: Record<string, unknown>;

  if (targetQueue === userManagementQueue) {
    payload = {
      email: process.env.ENQUEUE_EMAIL ?? "user@example.com",
      triggeredAt: new Date().toISOString()
    };
  } else if (targetQueue === identityEventsQueue) {
    payload = {
      type: process.env.IDENTITY_EVENT_TYPE ?? "tenant.provisioned",
      organizationId: process.env.IDENTITY_ORG_ID ?? "org-1",
      triggeredAt: new Date().toISOString()
    };
  } else {
    const rawPayload = process.env.BILLING_JOB_PAYLOAD ?? "{}";
    try {
      payload = JSON.parse(rawPayload);
    } catch (error) {
      throw new Error(`Failed to parse BILLING_JOB_PAYLOAD JSON: ${(error as Error).message}`);
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("BILLING_JOB_PAYLOAD must be a JSON object");
    }
  }

  const job = await targetQueue.add(
    event,
    {
      ...payload,
      triggeredAt: new Date().toISOString()
    },
    jobId
      ? {
          jobId
        }
      : undefined
  );

  logger.info(
    {
      jobId: job.id,
      event,
      queue: targetQueue.name,
      payload
    },
    "Enqueued job"
  );
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
