import { createHash, randomUUID } from "node:crypto";
import { ProductRole, TenantRole } from "@prisma/client";
import { logger, buildServiceRoleClaims } from "@ma/core";
import { createOrganizationWithOwner, createTenant, listTenants } from "../src/organizations";
import { disconnectPrisma, withAuthorizationTransaction } from "../src/prisma";
import { registerProduct, linkProductToTenant } from "../src/products";
import { grantEntitlement } from "../src/entitlements";
import { slugify } from "../src/utils/slugify";

const seed = async () => {
  const organizationName = "Seeded Organization";
  const organizationSlug = slugify(organizationName);

  const existingOrganization = await withAuthorizationTransaction(
    buildServiceRoleClaims(undefined),
    (tx) =>
      tx.organization.findUnique({
        where: { slug: organizationSlug }
      })
  );

  if (existingOrganization) {
    logger.info({ organizationId: existingOrganization.id }, "Seed data already present; skipping");
    return;
  }

  const ownerId = randomUUID();

  const { organization, defaultTenant, ownerMembership } = await createOrganizationWithOwner({
    name: organizationName,
    slug: organizationSlug,
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
    postLogoutRedirectUris: ["http://localhost:3300"],
    iconUrl: "https://static.grownext.dev/icons/tasks.png",
    launcherUrl: "http://localhost:3300"
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
