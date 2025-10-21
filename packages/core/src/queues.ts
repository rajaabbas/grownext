export const QUEUES = {
  USER_MANAGEMENT: "user-management-jobs",
  IDENTITY_EVENTS: "identity-events",
  TASK_NOTIFICATIONS: "task-notifications",
  SUPER_ADMIN_BULK_JOBS: "super-admin.bulk-job",
  BILLING_USAGE: "billing.usage",
  BILLING_INVOICE: "billing.invoice",
  BILLING_PAYMENT_SYNC: "billing.payment-sync"
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
