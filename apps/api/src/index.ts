import { env, logger } from "@ma/core";
import { buildServer } from "./server";

const server = buildServer();
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

const start = async () => {
  try {
    await server.listen({ port, host });
    logger.info({ port, host, version: env.APP_VERSION }, "API server started");
  } catch (error) {
    logger.error({ error }, "Failed to start API server");
    process.exit(1);
  }
};

const shutdown = async () => {
  logger.info("Shutting down API server");
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
