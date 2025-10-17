import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const taskNotificationsQueue = new Queue(QUEUES.TASK_NOTIFICATIONS, { connection });

export const enqueueTaskNotification = async (
  name: "task.assigned" | "task.commented" | "task.dueSoon",
  data: Record<string, unknown>,
  options?: JobsOptions
) => {
  await taskNotificationsQueue.add(name, data, {
    removeOnComplete: true,
    attempts: 3,
    ...options
  });
};

export const dueSoonJobId = (taskId: string): string => `task-dueSoon-${taskId}`;

export const cancelDueSoonNotification = async (taskId: string) => {
  try {
    await taskNotificationsQueue.remove(dueSoonJobId(taskId));
  } catch (error) {
    // ignore missing job
  }
};
