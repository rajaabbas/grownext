import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env, logger, QUEUES } from "@ma/core";

const RedisConstructor = IORedis as unknown as new (...args: unknown[]) => Redis;

const connection = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const userManagementQueue = new Queue(QUEUES.USER_MANAGEMENT, {
  connection
});

userManagementQueue.on("error", (error) => {
  logger.error({ error }, "Queue error");
});

export const closeUserManagementQueue = async () => {
  await userManagementQueue.close();
  await connection.quit();
};
