export const QUEUES = {
  USER_MANAGEMENT: "user-management-jobs"
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
