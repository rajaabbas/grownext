export const QUEUES = {
  USER_MANAGEMENT: "user-management-jobs",
  IDENTITY_EVENTS: "identity-events",
  TASK_NOTIFICATIONS: "task-notifications"
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
