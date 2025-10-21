"use strict";

import { performance } from "node:perf_hooks";
import { z } from "zod";
import { logger, buildServiceRoleClaims, type SupabaseJwtClaims } from "@ma/core";
import {
  prisma,
  Prisma,
  upsertBillingUsageAggregate,
  type UsageAggregateKey
} from "@ma/db";
import { BillingUsageResolutionValues, BillingUsageSourceValues } from "@ma/contracts";
import type { BillingUsageResolution, BillingUsageSource } from "@ma/db";

const usageJobSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  subscriptionId: z.string().min(1, "subscriptionId is required"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
  source: z.enum(BillingUsageSourceValues).default("WORKER"),
  featureKeys: z.array(z.string().min(1)).optional(),
  backfill: z.boolean().optional(),
  context: z.record(z.any()).optional()
});

type UsageJobPayload = z.infer<typeof usageJobSchema>;

interface UsageGroupResult {
  featureKey: string;
  unit: string;
  quantity: Prisma.Decimal;
}

type PrismaUsageGroup = {
  featureKey: string;
  unit: string;
  _sum: {
    quantity: Prisma.Decimal | null;
  };
};

export interface BillingUsageProcessorDeps {
  groupUsageEvents: (input: {
    organizationId: string;
    subscriptionId: string;
    featureKeys?: string[];
    periodStart: Date;
    periodEnd: Date;
  }) => Promise<UsageGroupResult[]>;
  upsertAggregate: (
    claims: SupabaseJwtClaims,
    key: UsageAggregateKey,
    quantity: Prisma.Decimal,
    unit: string,
    source: BillingUsageSource
  ) => Promise<unknown>;
  buildClaims: (organizationId: string) => SupabaseJwtClaims;
}

const defaultDeps: BillingUsageProcessorDeps = {
  groupUsageEvents: async (input) => {
    const groups = await prisma.billingUsageEvent.groupBy({
      by: ["featureKey", "unit"],
      where: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        featureKey: input.featureKeys ? { in: input.featureKeys } : undefined,
        recordedAt: {
          gte: input.periodStart,
          lt: input.periodEnd
        }
      },
      _sum: {
        quantity: true
      }
    });

    const typedGroups = groups as PrismaUsageGroup[];

    return typedGroups.map((group) => ({
      featureKey: group.featureKey,
      unit: group.unit,
      quantity: group._sum.quantity ?? new Prisma.Decimal(0)
    }));
  },
  upsertAggregate: async (claims, key, quantity, unit, source) => {
    await upsertBillingUsageAggregate(claims, key, quantity, unit, source);
  },
  buildClaims: buildServiceRoleClaims
};

export interface BillingUsageProcessorResult {
  aggregated: number;
  durationMs: number;
}

export const processBillingUsageJob = async (
  rawPayload: unknown,
  deps: BillingUsageProcessorDeps = defaultDeps
): Promise<BillingUsageProcessorResult> => {
  const startedAt = performance.now();
  const payload = usageJobSchema.parse(rawPayload);
  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);

  if (periodEnd <= periodStart) {
    throw new Error("periodEnd must be later than periodStart");
  }

  const claims = deps.buildClaims(payload.organizationId);
  const resolution = payload.resolution as BillingUsageResolution;
  const source = payload.source as BillingUsageSource;

  logger.info(
    {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      resolution,
      backfill: payload.backfill ?? false,
      featureKeys: payload.featureKeys ?? null
    },
    "Processing billing usage job"
  );

  const groups = await deps.groupUsageEvents({
    organizationId: payload.organizationId,
    subscriptionId: payload.subscriptionId,
    featureKeys: payload.featureKeys,
    periodStart,
    periodEnd
  });

  let aggregated = 0;

  for (const group of groups) {
    const quantity = group.quantity ?? new Prisma.Decimal(0);

    const key: UsageAggregateKey = {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId,
      featureKey: group.featureKey,
      resolution,
      periodStart,
      periodEnd
    };

    await deps.upsertAggregate(claims, key, quantity, group.unit, source);
    aggregated += 1;
  }

  const durationMs = performance.now() - startedAt;

  logger.info(
    {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId,
      aggregated,
      durationMs: Number(durationMs.toFixed(2))
    },
    "Billing usage job completed"
  );

  return {
    aggregated,
    durationMs
  };
};
