import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const shouldSkipQueueConnection =
  process.env.SKIP_QUEUE_CONNECTION === "true" || process.env.NEXT_PHASE === "phase-production-build";

let taskNotificationsQueue: Queue | null = null;

if (!shouldSkipQueueConnection) {
  try {
    const connection = new RedisConstructor(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
    taskNotificationsQueue = new Queue(QUEUES.TASK_NOTIFICATIONS, { connection });
  } catch (error) {
    console.warn("Tasks queue unavailable; continuing without Redis connection", error);
    taskNotificationsQueue = null;
  }
}

export const enqueueTaskNotification = async (
  name: "task.assigned" | "task.commented" | "task.dueSoon",
  data: Record<string, unknown>,
  options?: JobsOptions
) => {
  if (!taskNotificationsQueue) {
    return;
  }

  await taskNotificationsQueue.add(name, data, {
    removeOnComplete: true,
    attempts: 3,
    ...options
  });
};

export const dueSoonJobId = (taskId: string): string => `task-dueSoon-${taskId}`;

export const cancelDueSoonNotification = async (taskId: string) => {
  if (!taskNotificationsQueue) {
    return;
  }

  try {
    await taskNotificationsQueue.remove(dueSoonJobId(taskId));
  } catch (error) {
    // ignore missing job
  }
};
