import { createHash, randomUUID } from "node:crypto";
import {
  BillingContactRole,
  BillingCreditReason,
  BillingInvoiceLineType,
  BillingInvoiceStatus,
  BillingLimitType,
  BillingPaymentMethodType,
  BillingUsagePeriod,
  BillingUsageResolution,
  BillingUsageSource,
  BillingSubscriptionStatus,
  ProductRole,
  TenantRole
} from "@prisma/client";
import { logger, buildServiceRoleClaims } from "@ma/core";
import { createOrganizationWithOwner, createTenant, listTenants } from "../src/organizations";
import { disconnectPrisma, withAuthorizationTransaction } from "../src/prisma";
import { registerProduct, linkProductToTenant } from "../src/products";
import { grantEntitlement } from "../src/entitlements";
import {
  createBillingPackage,
  createBillingSubscription,
  addBillingInvoiceLine,
  createBillingInvoice,
  upsertBillingUsageAggregate,
  recordBillingUsageEvents,
  upsertBillingPaymentMethod,
  createBillingCreditMemo,
  listBillingPackages,
  replaceBillingContacts,
  replaceBillingTaxIds
} from "../src/billing";
import { slugify } from "../src/utils/slugify";

const seed = async () => {
  const organizationName = "Seeded Organization";
  const organizationSlug = slugify(organizationName);

  const serviceClaims = buildServiceRoleClaims(undefined);

  const existingOrganization = await withAuthorizationTransaction(serviceClaims, (tx) =>
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
    roles: [ProductRole.ADMIN]
  });

  const existingPackages = await listBillingPackages(serviceClaims, { includeInactive: true });

  let starterPackage = existingPackages.find((pkg) => pkg.slug === "starter");
  if (!starterPackage) {
    starterPackage = await createBillingPackage(serviceClaims, {
      slug: "starter",
      name: "Starter",
      description: "Baseline plan for growing teams.",
      amountCents: 2900,
      interval: "MONTHLY",
      featureLimits: [
        {
          featureKey: "seats",
          limitType: BillingLimitType.HARD,
          limitValue: 15,
          limitUnit: "users",
          usagePeriod: BillingUsagePeriod.LIFETIME
        },
        {
          featureKey: "tenants",
          limitType: BillingLimitType.HARD,
          limitValue: 3,
          limitUnit: "workspaces",
          usagePeriod: BillingUsagePeriod.LIFETIME
        },
        {
          featureKey: "ai.tokens",
          limitType: BillingLimitType.SOFT,
          limitValue: 200000,
          limitUnit: "tokens",
          usagePeriod: BillingUsagePeriod.MONTHLY
        }
      ]
    });
  }

  let scalePackage = existingPackages.find((pkg) => pkg.slug === "scale");
  if (!scalePackage) {
    scalePackage = await createBillingPackage(serviceClaims, {
      slug: "scale",
      name: "Scale",
      description: "Advanced plan with higher usage ceilings.",
      amountCents: 6900,
      interval: "MONTHLY",
      featureLimits: [
        {
          featureKey: "seats",
          limitType: BillingLimitType.SOFT,
          limitValue: 50,
          limitUnit: "users",
          usagePeriod: BillingUsagePeriod.LIFETIME
        },
        {
          featureKey: "tenants",
          limitType: BillingLimitType.SOFT,
          limitValue: 10,
          limitUnit: "workspaces",
          usagePeriod: BillingUsagePeriod.LIFETIME
        },
        {
          featureKey: "ai.tokens",
          limitType: BillingLimitType.SOFT,
          limitValue: 1000000,
          limitUnit: "tokens",
          usagePeriod: BillingUsagePeriod.MONTHLY
        }
      ]
    });
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime());
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await createBillingSubscription(serviceClaims, {
    organizationId: organization.id,
    packageId: starterPackage.id,
    amountCents: starterPackage.amountCents,
    billingInterval: starterPackage.interval,
    currency: starterPackage.currency,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    status: BillingSubscriptionStatus.ACTIVE
  });

  await recordBillingUsageEvents(serviceClaims, [
    {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      tenantId: defaultTenant.id,
      productId: product.id,
      featureKey: "ai.tokens",
      quantity: 12500,
      unit: "tokens",
      recordedAt: now,
      source: BillingUsageSource.WORKER,
      metadata: { seeded: true }
    }
  ]);

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime());
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  await upsertBillingUsageAggregate(
    serviceClaims,
    {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      featureKey: "ai.tokens",
      resolution: BillingUsageResolution.DAILY,
      periodStart: startOfDay,
      periodEnd: endOfDay
    },
    12500,
    "tokens",
    BillingUsageSource.WORKER
  );

  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${organization.slug?.toUpperCase() ?? "ORG"}`;

  const invoice = await createBillingInvoice(serviceClaims, {
    organizationId: organization.id,
    subscriptionId: subscription.id,
    number: invoiceNumber,
    status: BillingInvoiceStatus.PAID,
    currency: starterPackage.currency,
    subtotalCents: starterPackage.amountCents + 1500,
    taxCents: 0,
    totalCents: starterPackage.amountCents + 1500,
    balanceCents: 0,
    issuedAt: now,
    paidAt: now,
    dueAt: now
  });

  await addBillingInvoiceLine(serviceClaims, {
    invoiceId: invoice.id,
    lineType: BillingInvoiceLineType.RECURRING,
    description: `${starterPackage.name} plan`,
    featureKey: "subscription",
    quantity: 1,
    unitAmountCents: starterPackage.amountCents,
    amountCents: starterPackage.amountCents
  });

  await addBillingInvoiceLine(serviceClaims, {
    invoiceId: invoice.id,
    lineType: BillingInvoiceLineType.USAGE,
    description: "AI tokens",
    featureKey: "ai.tokens",
    quantity: 12500,
    unitAmountCents: 0,
    amountCents: 1500,
    usagePeriodStart: startOfDay,
    usagePeriodEnd: endOfDay
  });

  await upsertBillingPaymentMethod(serviceClaims, {
    organizationId: organization.id,
    providerId: "pm_seed_card",
    type: BillingPaymentMethodType.CARD,
    brand: "Visa",
    last4: "4242",
    expMonth: 12,
    expYear: new Date().getFullYear() + 5,
    isDefault: true,
    metadata: { seeded: true }
  });

  await createBillingCreditMemo(serviceClaims, {
    organizationId: organization.id,
    invoiceId: invoice.id,
    amountCents: 500,
    reason: BillingCreditReason.PROMOTION,
    metadata: { seeded: true }
  });

  await replaceBillingContacts(serviceClaims, organization.id, [
    {
      name: "Seed Finance Lead",
      email: "finance@example.com",
      role: BillingContactRole.finance,
      phone: "+1-415-555-1212",
      metadata: { seeded: true }
    },
    {
      name: "Seed Technical Contact",
      email: "tech@example.com",
      role: BillingContactRole.technical,
      metadata: { seeded: true }
    }
  ]);

  await replaceBillingTaxIds(serviceClaims, organization.id, [
    {
      type: "vat",
      value: "US123456789",
      country: "US",
      verified: true,
      metadata: { seeded: true }
    }
  ]);

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
