"use strict";

import { describe, expect, it, vi } from "vitest";
import { IdentityHttpError } from "@ma/identity-client";
import { logger } from "@ma/core";
import { processBillingUsageJob, type BillingUsageProcessorDeps } from "./billing-usage";

const buildDeps = (
  overrides: Partial<BillingUsageProcessorDeps> = {}
): BillingUsageProcessorDeps => ({
  aggregateUsage: vi.fn().mockResolvedValue({ aggregated: 0, durationMs: 0 }),
  ...overrides
});

describe("processBillingUsageJob", () => {
  it("forwards payload to aggregate usage dependency", async () => {
    const aggregateUsage = vi.fn().mockResolvedValue({ aggregated: 3, durationMs: 42 });
    const deps = buildDeps({ aggregateUsage });

    const payload = {
      organizationId: "org-1",
      subscriptionId: "sub-1",
      periodStart: "2024-10-23T00:00:00Z",
      periodEnd: "2024-10-24T00:00:00Z",
      resolution: "DAILY",
      featureKeys: ["ai.tokens"],
      source: "WORKER"
    } as const;

    const result = await processBillingUsageJob(payload, deps);

    expect(aggregateUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        periodStart: "2024-10-23T00:00:00Z",
        periodEnd: "2024-10-24T00:00:00Z",
        resolution: "DAILY",
        source: "WORKER",
        featureKeys: ["ai.tokens"]
      })
    );
    expect(result).toEqual({ aggregated: 3, durationMs: 42 });
  });

  it("throws when period end is not after period start", async () => {
    await expect(
      processBillingUsageJob(
        {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          periodStart: "2024-10-23T00:00:00Z",
          periodEnd: "2024-10-23T00:00:00Z"
        },
        buildDeps()
      )
    ).rejects.toThrow("periodEnd must be later than periodStart");
  });

  it("logs and rethrows identity rate limit errors", async () => {
    const identityError = new IdentityHttpError("rate limited", {
      status: 429,
      retryAfter: 15
    });
    const aggregateUsage = vi.fn().mockRejectedValue(identityError);
    const deps = buildDeps({ aggregateUsage });
    const errorSpy = vi.spyOn(logger, "error");

    await expect(
      processBillingUsageJob(
        {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          periodStart: "2024-10-23T00:00:00Z",
          periodEnd: "2024-10-24T00:00:00Z",
          resolution: "DAILY"
        },
        deps
      )
    ).rejects.toBe(identityError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        retryAfterSeconds: 15,
        error: "rate limited"
      }),
      "Billing usage aggregation throttled"
    );

    errorSpy.mockRestore();
  });
});
