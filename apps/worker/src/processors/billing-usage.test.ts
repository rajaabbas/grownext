"use strict";

import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@ma/db";
import type { SupabaseJwtClaims } from "@ma/core";
import { processBillingUsageJob, type BillingUsageProcessorDeps } from "./billing-usage";

const baseClaims: SupabaseJwtClaims = {
  sub: "service-role",
  role: "authenticated",
  organization_id: "org-1"
};

const buildDeps = (
  overrides: Partial<BillingUsageProcessorDeps> = {}
): BillingUsageProcessorDeps => {
  const defaultDeps: BillingUsageProcessorDeps = {
    groupUsageEvents: vi.fn(),
    upsertAggregate: vi.fn(),
    buildClaims: vi.fn().mockReturnValue(baseClaims)
  };

  return {
    ...defaultDeps,
    ...overrides
  };
};

describe("processBillingUsageJob", () => {
  it("aggregates grouped usage events into rollups", async () => {
    const groupUsageEvents = vi.fn().mockResolvedValue([
      {
        featureKey: "ai.tokens",
        unit: "tokens",
        quantity: new Prisma.Decimal(1500)
      }
    ]);
    const upsertAggregate = vi.fn().mockResolvedValue(undefined);

    const deps = buildDeps({
      groupUsageEvents,
      upsertAggregate
    });

    const result = await processBillingUsageJob(
      {
        organizationId: "org-1",
        subscriptionId: "sub-1",
        periodStart: new Date("2024-04-01T00:00:00Z").toISOString(),
        periodEnd: new Date("2024-04-02T00:00:00Z").toISOString(),
        resolution: "DAILY",
        featureKeys: ["ai.tokens"]
      },
      deps
    );

    expect(groupUsageEvents).toHaveBeenCalledWith({
      organizationId: "org-1",
      subscriptionId: "sub-1",
      featureKeys: ["ai.tokens"],
      periodStart: new Date("2024-04-01T00:00:00Z"),
      periodEnd: new Date("2024-04-02T00:00:00Z")
    });

    expect(upsertAggregate).toHaveBeenCalledTimes(1);
    expect(upsertAggregate).toHaveBeenCalledWith(
      baseClaims,
      {
        organizationId: "org-1",
        subscriptionId: "sub-1",
        featureKey: "ai.tokens",
        resolution: "DAILY",
        periodStart: new Date("2024-04-01T00:00:00Z"),
        periodEnd: new Date("2024-04-02T00:00:00Z")
      },
      new Prisma.Decimal(1500),
      "tokens",
      "WORKER"
    );

    expect(result.aggregated).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("short-circuits when no usage events found", async () => {
    const groupUsageEvents = vi.fn().mockResolvedValue([]);
    const upsertAggregate = vi.fn();

    const deps = buildDeps({
      groupUsageEvents,
      upsertAggregate
    });

    const result = await processBillingUsageJob(
      {
        organizationId: "org-1",
        subscriptionId: "sub-1",
        periodStart: new Date("2024-04-01T00:00:00Z").toISOString(),
        periodEnd: new Date("2024-04-02T00:00:00Z").toISOString()
      },
      deps
    );

    expect(groupUsageEvents).toHaveBeenCalledTimes(1);
    expect(upsertAggregate).not.toHaveBeenCalled();
    expect(result.aggregated).toBe(0);
  });

  it("throws when period end is not after period start", async () => {
    const deps = buildDeps();

    await expect(
      processBillingUsageJob(
        {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          periodStart: new Date("2024-04-01T00:00:00Z").toISOString(),
          periodEnd: new Date("2024-04-01T00:00:00Z").toISOString()
        },
        deps
      )
    ).rejects.toThrow("periodEnd must be later than periodStart");
  });
});
