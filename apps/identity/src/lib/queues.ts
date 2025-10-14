import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

export interface IdentityQueues {
  identityEvents: Queue;
  userManagement: Queue;
  close: () => Promise<void>;
  emitIdentityEvent: (event: string, payload: Record<string, unknown>) => Promise<void>;
  emitUserManagementJob: (event: string, payload: Record<string, unknown>) => Promise<void>;
}

export const createIdentityQueues = (): IdentityQueues => {
  const connection = new RedisConstructor(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  const identityEvents = new Queue(QUEUES.IDENTITY_EVENTS, { connection });
  const userManagement = new Queue(QUEUES.USER_MANAGEMENT, { connection });

  const emitIdentityEvent = async (event: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: identityEvents.name, event, payload }, "Enqueue identity event");
    await identityEvents.add(event, payload, { removeOnComplete: 100, removeOnFail: 50 });
  };

  const emitUserManagementJob = async (event: string, payload: Record<string, unknown>) => {
    logger.debug({ queue: userManagement.name, event, payload }, "Enqueue user management job");
    await userManagement.add(event, payload, { removeOnComplete: 100, removeOnFail: 50 });
  };

  const close = async () => {
    await Promise.all([identityEvents.close(), userManagement.close()]);
    await connection.quit();
  };

  const handleQueueError = (queue: Queue) => {
    queue.on("error", (error: Error) => {
      logger.error({ queue: queue.name, error }, "Queue error");
    });
  };

  handleQueueError(identityEvents);
  handleQueueError(userManagement);

  return {
    identityEvents,
    userManagement,
    emitIdentityEvent,
    emitUserManagementJob,
    close
  };
};
