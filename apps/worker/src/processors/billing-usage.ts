"use strict";

import { z } from "zod";
import { logger, env } from "@ma/core";
import { BillingUsageResolutionValues, BillingUsageSourceValues } from "@ma/contracts";
import { aggregateBillingUsage, IdentityHttpError } from "@ma/identity-client";

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

export interface BillingUsageProcessorDeps {
  aggregateUsage: (payload: UsageJobPayload) => Promise<BillingUsageProcessorResult>;
}

const createDefaultDeps = (): BillingUsageProcessorDeps => {
  const accessToken = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to process billing usage jobs");
  }
  return {
    aggregateUsage: (payload) => aggregateBillingUsage(accessToken, payload)
  };
};

export interface BillingUsageProcessorResult {
  aggregated: number;
  durationMs: number;
}

export const processBillingUsageJob = async (
  rawPayload: unknown,
  deps: BillingUsageProcessorDeps = createDefaultDeps()
): Promise<BillingUsageProcessorResult> => {
  const payload = usageJobSchema.parse(rawPayload);
  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);

  if (periodEnd <= periodStart) {
    throw new Error("periodEnd must be later than periodStart");
  }

  logger.info(
    {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      resolution: payload.resolution,
      backfill: payload.backfill ?? false,
      featureKeys: payload.featureKeys ?? null
    },
    "Processing billing usage job"
  );

  let result: BillingUsageProcessorResult;

  try {
    result = await deps.aggregateUsage(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown aggregation failure";
    const isRateLimited =
      error instanceof IdentityHttpError
        ? error.status === 429
        : message.includes("429") || message.toLowerCase().includes("rate");
    logger.error(
      {
        organizationId: payload.organizationId,
        subscriptionId: payload.subscriptionId,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        resolution: payload.resolution,
        backfill: payload.backfill ?? false,
        featureKeys: payload.featureKeys ?? null,
        error: message,
        retryAfterSeconds: error instanceof IdentityHttpError ? error.retryAfter ?? null : null
      },
      isRateLimited ? "Billing usage aggregation throttled" : "Billing usage aggregation failed"
    );
    throw error;
  }

  logger.info(
    {
      organizationId: payload.organizationId,
      subscriptionId: payload.subscriptionId,
      aggregated: result.aggregated,
      durationMs: Number(result.durationMs.toFixed(2))
    },
    "Billing usage job completed"
  );

  return result;
};
