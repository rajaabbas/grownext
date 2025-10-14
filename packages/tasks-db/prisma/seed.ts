import { randomUUID } from "node:crypto";
import { buildServiceRoleClaims, logger } from "@ma/core";
import { createTask } from "../src/tasks";
import { disconnectPrisma } from "../src/prisma";

const organizationId = process.env.TASKS_SEED_ORGANIZATION_ID;
const tenantId = process.env.TASKS_SEED_TENANT_ID;
const createdById = process.env.TASKS_SEED_USER_ID ?? randomUUID();

const run = async () => {
  if (!organizationId || !tenantId) {
    logger.warn(
      "Skipping tasks seed because TASKS_SEED_ORGANIZATION_ID or TASKS_SEED_TENANT_ID was not provided"
    );
    return;
  }

  const claims = buildServiceRoleClaims(organizationId);

  await createTask(claims, {
    organizationId,
    tenantId,
    title: "Review onboarding playbook",
    description: "Ensure all teams have access to the identity portal and tasks workspace.",
    createdById
  });

  await createTask(claims, {
    organizationId,
    tenantId,
    title: "Invite first workspace members",
    description: "Add at least two collaborators to start collaborating in Tasks.",
    createdById
  });

  logger.info(
    { organizationId, tenantId },
    "Seeded sample tasks into dedicated tasks database"
  );
};

run()
  .then(() => disconnectPrisma())
  .catch(async (error) => {
    logger.error({ error }, "Tasks seed failed");
    await disconnectPrisma();
    process.exit(1);
  });
