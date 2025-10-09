import { logger } from "@ma/core";
import { disconnectPrisma } from "../src";

const run = async () => {
  logger.info("No seed data defined for the user management domain.");
};

run()
  .then(() => {
    logger.info("Seed complete");
    return disconnectPrisma();
  })
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    disconnectPrisma().finally(() => {
      process.exit(1);
    });
  });
