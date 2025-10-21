import { Prisma } from "@prisma/client";
import type {
  BillingFeatureLimit,
  BillingLimitType,
  BillingPackage,
  BillingUsagePeriod
} from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { randomUUID } from "node:crypto";
import { slugify } from "../utils/slugify";
import { withAuthorizationTransaction } from "../prisma";

interface FeatureLimitInput {
  featureKey: string;
  limitType: BillingLimitType;
  limitValue?: number | null;
  limitUnit?: string | null;
  usagePeriod?: BillingUsagePeriod | null;
  metadata?: Prisma.JsonValue | null;
}

interface CreateBillingPackageInput {
  slug?: string | null;
  name: string;
  description?: string | null;
  active?: boolean;
  currency?: string;
  interval?: BillingPackage["interval"];
  amountCents: number;
  trialPeriodDays?: number | null;
  metadata?: Prisma.JsonValue | null;
  featureLimits?: FeatureLimitInput[];
}

interface UpdateBillingPackageInput {
  name?: string;
  description?: string | null;
  active?: boolean;
  currency?: string;
  interval?: BillingPackage["interval"];
  amountCents?: number;
  trialPeriodDays?: number | null;
  metadata?: Prisma.JsonValue | null;
  featureLimits?: FeatureLimitInput[];
}

const buildFeatureLimitData = (input: FeatureLimitInput) => ({
  id: randomUUID(),
  featureKey: input.featureKey,
  limitType: input.limitType,
  limitValue: input.limitValue ?? null,
  limitUnit: input.limitUnit ?? null,
  usagePeriod: input.usagePeriod ?? null,
  metadata: input.metadata ?? Prisma.JsonNull
});

export const listBillingPackages = async (
  claims: SupabaseJwtClaims | null,
  options?: { includeInactive?: boolean }
): Promise<(BillingPackage & { featureLimits: BillingFeatureLimit[] })[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPackage.findMany({
      where: options?.includeInactive ? undefined : { active: true },
      include: { featureLimits: true },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const getBillingPackageById = async (
  claims: SupabaseJwtClaims | null,
  id: string
): Promise<(BillingPackage & { featureLimits: BillingFeatureLimit[] }) | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPackage.findUnique({
      where: { id },
      include: { featureLimits: true }
    })
  );
};

export const getBillingPackageBySlug = async (
  claims: SupabaseJwtClaims | null,
  slug: string
): Promise<(BillingPackage & { featureLimits: BillingFeatureLimit[] }) | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPackage.findUnique({
      where: { slug },
      include: { featureLimits: true }
    })
  );
};

export const createBillingPackage = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBillingPackageInput
): Promise<BillingPackage & { featureLimits: BillingFeatureLimit[] }> => {
  const slug = input.slug && input.slug.length > 0 ? input.slug : slugify(input.name);

  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPackage.create({
      data: {
        slug,
        name: input.name,
        description: input.description ?? null,
        active: input.active ?? true,
        currency: input.currency ?? "usd",
        interval: input.interval ?? "MONTHLY",
        amountCents: input.amountCents,
        trialPeriodDays: input.trialPeriodDays ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        featureLimits: input.featureLimits
          ? {
              create: input.featureLimits.map((limit) => buildFeatureLimitData(limit))
            }
          : undefined
      },
      include: { featureLimits: true }
    })
  );
};

export const updateBillingPackage = async (
  claims: SupabaseJwtClaims | null,
  packageId: string,
  input: UpdateBillingPackageInput
): Promise<BillingPackage & { featureLimits: BillingFeatureLimit[] }> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const result = await tx.billingPackage.update({
      where: { id: packageId },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        active: input.active ?? undefined,
        currency: input.currency ?? undefined,
        interval: input.interval ?? undefined,
        amountCents: input.amountCents ?? undefined,
        trialPeriodDays: input.trialPeriodDays ?? undefined,
        metadata:
          input.metadata !== undefined ? input.metadata ?? Prisma.JsonNull : undefined
      }
    });

    if (input.featureLimits) {
      const featureKeys = input.featureLimits.map((limit) => limit.featureKey);

      await tx.billingFeatureLimit.deleteMany({
        where: {
          packageId,
          featureKey: { notIn: featureKeys }
        }
      });

      for (const limit of input.featureLimits) {
        await tx.billingFeatureLimit.upsert({
          where: {
            packageId_featureKey: {
              packageId,
              featureKey: limit.featureKey
            }
          },
          update: {
            limitType: limit.limitType,
            limitValue: limit.limitValue ?? null,
            limitUnit: limit.limitUnit ?? null,
            usagePeriod: limit.usagePeriod ?? null,
            metadata: limit.metadata ?? Prisma.JsonNull
          },
          create: {
            id: randomUUID(),
            packageId,
            featureKey: limit.featureKey,
            limitType: limit.limitType,
            limitValue: limit.limitValue ?? null,
            limitUnit: limit.limitUnit ?? null,
            usagePeriod: limit.usagePeriod ?? null,
            metadata: limit.metadata ?? Prisma.JsonNull
          }
        });
      }
    }

    return tx.billingPackage.findUniqueOrThrow({
      where: { id: result.id },
      include: { featureLimits: true }
    });
  });
};

export const archiveBillingPackage = async (
  claims: SupabaseJwtClaims | null,
  packageId: string
): Promise<BillingPackage> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPackage.update({
      where: { id: packageId },
      data: { active: false }
    })
  );
};
