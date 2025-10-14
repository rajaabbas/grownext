import { createHash, randomUUID } from "node:crypto";
import { ProductRole, TenantRole } from "@prisma/client";
import { logger } from "@ma/core";
import { createOrganizationWithOwner, createTenant, listTenants } from "../src/organizations";
import { disconnectPrisma } from "../src/prisma";
import { registerProduct, linkProductToTenant } from "../src/products";
import { grantEntitlement } from "../src/entitlements";

const seed = async () => {
  const ownerId = randomUUID();

  const { organization, defaultTenant, ownerMembership } = await createOrganizationWithOwner({
    name: "Seeded Organization",
    owner: {
      userId: ownerId,
      email: "owner@example.com",
      fullName: "Seed Owner"
    }
  });

  await createTenant(null, {
    organizationId: organization.id,
    name: "Studio",
    description: "Design studio workspace",
    grantingMemberId: ownerMembership.id,
    role: TenantRole.ADMIN
  });

  const tenants = await listTenants(null, organization.id);

  const product = await registerProduct(null, {
    name: "Tasks",
    description: "Seeded task management app",
    clientSecretHash: createHash("sha256").update("tasks-client-secret").digest("hex"),
    scopes: ["tasks:read", "tasks:write"],
    redirectUris: ["http://localhost:3300/callback"],
    postLogoutRedirectUris: ["http://localhost:3300"]
  });

  await linkProductToTenant(null, {
    tenantId: defaultTenant.id,
    productId: product.id
  });

  await grantEntitlement(null, {
    organizationId: organization.id,
    tenantId: defaultTenant.id,
    productId: product.id,
    userId: ownerId,
    roles: [ProductRole.OWNER]
  });

  logger.info({ organization, defaultTenant, tenants }, "Seed data created");
};

seed()
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
