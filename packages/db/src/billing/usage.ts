import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type {
  BillingUsageAggregate,
  BillingUsageEvent,
  BillingUsageResolution,
  BillingUsageSource
} from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "../prisma";

const toDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal =>
  Prisma.Decimal.isDecimal(value) ? (value as Prisma.Decimal) : new Prisma.Decimal(value);

export interface RecordBillingUsageEventInput {
  organizationId: string;
  featureKey: string;
  quantity: Prisma.Decimal | number | string;
  unit: string;
  recordedAt: Date;
  source: BillingUsageSource;
  tenantId?: string | null;
  subscriptionId?: string | null;
  productId?: string | null;
  fingerprint?: string | null;
  metadata?: Prisma.JsonValue | null;
}

export interface UsageAggregateKey {
  organizationId: string;
  subscriptionId: string;
  featureKey: string;
  resolution: BillingUsageResolution;
  periodStart: Date;
  periodEnd: Date;
}

export const recordBillingUsageEvents = async (
  claims: SupabaseJwtClaims | null,
  events: RecordBillingUsageEventInput[]
): Promise<number> => {
  if (events.length === 0) {
    return 0;
  }

  const payload = events.map((event) => {
    const quantity = toDecimal(event.quantity);

    const fingerprint =
      event.fingerprint && event.fingerprint.length > 0
        ? event.fingerprint
        : createHash("sha256")
            .update(
              [
                event.organizationId,
                event.subscriptionId ?? "",
                event.featureKey,
                event.unit,
                event.recordedAt.toISOString(),
                quantity.toString()
              ].join("|")
            )
            .digest("hex");

    return {
      organizationId: event.organizationId,
      subscriptionId: event.subscriptionId ?? null,
      tenantId: event.tenantId ?? null,
      productId: event.productId ?? null,
      featureKey: event.featureKey,
      quantity,
      unit: event.unit,
      recordedAt: event.recordedAt,
      source: event.source,
      fingerprint,
      metadata: event.metadata ?? Prisma.JsonNull
    };
  });

  const result = await withAuthorizationTransaction(claims, (tx) =>
    tx.billingUsageEvent.createMany({
      data: payload,
      skipDuplicates: true
    })
  );

  return result.count;
};

export const listBillingUsageEvents = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  options?: { featureKey?: string; limit?: number }
): Promise<BillingUsageEvent[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingUsageEvent.findMany({
      where: {
        organizationId,
        featureKey: options?.featureKey ?? undefined
      },
      orderBy: { recordedAt: "desc" },
      take: options?.limit ?? 100
    })
  );
};

export const listBillingUsageAggregates = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  options: {
    featureKey?: string;
    resolution?: BillingUsageResolution;
    periodStart?: Date;
    periodEnd?: Date;
    subscriptionId?: string;
    limit?: number;
  } = {}
): Promise<BillingUsageAggregate[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingUsageAggregate.findMany({
      where: {
        organizationId,
        featureKey: options.featureKey ?? undefined,
        resolution: options.resolution ?? undefined,
        subscriptionId: options.subscriptionId ?? undefined,
        periodStart: options.periodStart ?? undefined,
        periodEnd: options.periodEnd ?? undefined
      },
      orderBy: { periodStart: "desc" },
      take: options.limit ?? 50
    })
  );
};

export const upsertBillingUsageAggregate = async (
  claims: SupabaseJwtClaims | null,
  key: UsageAggregateKey,
  quantity: Prisma.Decimal | number | string,
  unit: string,
  source: BillingUsageSource
): Promise<BillingUsageAggregate> => {
  const decimalQuantity = toDecimal(quantity);

  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingUsageAggregate.upsert({
      where: {
        organizationId_subscriptionId_featureKey_resolution_periodStart_periodEnd: {
          organizationId: key.organizationId,
          subscriptionId: key.subscriptionId,
          featureKey: key.featureKey,
          resolution: key.resolution,
          periodStart: key.periodStart,
          periodEnd: key.periodEnd
        }
      },
      update: {
        quantity: decimalQuantity,
        unit,
        source,
        updatedAt: new Date()
      },
      create: {
        organizationId: key.organizationId,
        subscriptionId: key.subscriptionId,
        featureKey: key.featureKey,
        resolution: key.resolution,
        periodStart: key.periodStart,
        periodEnd: key.periodEnd,
        quantity: decimalQuantity,
        unit,
        source
      }
    })
  );
};

export const incrementBillingUsageAggregate = async (
  claims: SupabaseJwtClaims | null,
  key: UsageAggregateKey,
  unit: string,
  amount: Prisma.Decimal | number | string,
  source: BillingUsageSource = "WORKER"
): Promise<BillingUsageAggregate> => {
  const incrementValue = toDecimal(amount);

  return withAuthorizationTransaction(claims, async (tx) => {
    try {
      return await tx.billingUsageAggregate.update({
        where: {
          organizationId_subscriptionId_featureKey_resolution_periodStart_periodEnd: {
            organizationId: key.organizationId,
            subscriptionId: key.subscriptionId,
            featureKey: key.featureKey,
            resolution: key.resolution,
            periodStart: key.periodStart,
            periodEnd: key.periodEnd
          }
        },
        data: {
          quantity: {
            increment: incrementValue
          },
          unit,
          source
        }
      });
    } catch (error) {
      return tx.billingUsageAggregate.create({
        data: {
          organizationId: key.organizationId,
          subscriptionId: key.subscriptionId,
          featureKey: key.featureKey,
          resolution: key.resolution,
          periodStart: key.periodStart,
          periodEnd: key.periodEnd,
          quantity: incrementValue,
          unit,
          source
        }
      });
    }
  });
};
