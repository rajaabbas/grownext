import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPassThroughSchema = vi.hoisted(() => () => ({
  parse: <T>(value: T) => value
}));

vi.mock("@ma/contracts", async () => {
  const actual = await vi.importActual<typeof import("@ma/contracts")>("@ma/contracts");
  const makeSchema = createPassThroughSchema();
  return {
    ...actual,
    BillingUsageResolutionValues: actual.BillingUsageResolutionValues,
    BillingUsageSourceValues: actual.BillingUsageSourceValues,
    BillingInvoiceStatusValues: actual.BillingInvoiceStatusValues,
    BillingInvoiceLineTypeValues: actual.BillingInvoiceLineTypeValues,
    BillingCreditReasonValues: actual.BillingCreditReasonValues,
    BillingUsageEventInputSchema: makeSchema,
    BillingUsageQuerySchema: { parse: <T>(value: T) => value },
    BillingUsageEventsResultSchema: makeSchema,
    PortalBillingOverviewResponseSchema: makeSchema,
    PortalBillingSubscriptionChangeRequestSchema: makeSchema,
    PortalBillingSubscriptionCancelRequestSchema: makeSchema,
    PortalBillingSubscriptionChangeResponseSchema: makeSchema,
    PortalBillingInvoiceListResponseSchema: makeSchema,
    PortalBillingContactsResponseSchema: makeSchema,
    PortalBillingContactsUpdateRequestSchema: makeSchema,
    PortalBillingPaymentMethodsResponseSchema: makeSchema,
    PortalBillingPaymentMethodUpsertRequestSchema: makeSchema,
    PortalBillingSetDefaultPaymentMethodRequestSchema: makeSchema,
    AdminBillingCatalogResponseSchema: makeSchema
  };
});

import {
  changePortalBillingSubscription,
  emitBillingUsageEvents,
  fetchAdminBillingCatalog,
  fetchPortalBillingOverview,
  IdentityHttpError
} from "./http";

const originalFetch = globalThis.fetch;
const originalIdentityBaseUrl = process.env.IDENTITY_BASE_URL;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.IDENTITY_BASE_URL = "https://identity.test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalIdentityBaseUrl === undefined) {
    delete process.env.IDENTITY_BASE_URL;
  } else {
    process.env.IDENTITY_BASE_URL = originalIdentityBaseUrl;
  }
});

describe("billing client headers", () => {
  it("sends usage batches with authorization headers", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ accepted: 3 })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await emitBillingUsageEvents("token-123", [
      { organizationId: "org-1", featureKey: "messages", quantity: 1, unit: "requests" },
      { organizationId: "org-1", featureKey: "messages", quantity: 2, unit: "requests" }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.test/internal/billing/usage/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "Content-Type": "application/json"
        })
      })
    );
    expect(result.accepted).toBe(3);
  });

  it("fetches portal billing overview with enforced headers", async () => {
    const now = new Date().toISOString();
    const overviewPayload = {
      overview: {
        organizationId: "org-1",
        subscription: {
          id: "sub-1",
          organizationId: "org-1",
          packageId: "pkg-pro",
          status: "ACTIVE",
          currency: "usd",
          amountCents: 2500,
          billingInterval: "MONTHLY",
          currentPeriodStart: now,
          currentPeriodEnd: now,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          externalId: "stripe-sub-1",
          metadata: null,
          package: {
            id: "pkg-pro",
            slug: "pro",
            name: "Pro",
            description: "Pro plan",
            currency: "usd",
            interval: "MONTHLY",
            amountCents: 2500,
            trialPeriodDays: 14,
            featureLimits: []
          }
        },
        activePackage: {
          id: "pkg-pro",
          slug: "pro",
          name: "Pro",
          description: "Pro plan",
          active: true,
          currency: "usd",
          interval: "MONTHLY",
          amountCents: 2500,
          trialPeriodDays: 14,
          metadata: null,
          featureLimits: []
        },
        scheduledChanges: [],
        usageSummaries: [],
        paymentMethods: [
          {
            id: "pm-1",
            organizationId: "org-1",
            type: "CARD",
            status: "ACTIVE",
            providerId: "card_123",
            reference: null,
            brand: "visa",
            last4: "4242",
            expMonth: 12,
            expYear: 2030,
            isDefault: true,
            metadata: null
          }
        ],
        defaultPaymentMethodId: "pm-1",
        contacts: [],
        taxIds: [],
        outstandingBalanceCents: 0,
        upcomingInvoice: null,
        recentInvoices: [
          {
            id: "inv-1",
            organizationId: "org-1",
            subscriptionId: "sub-1",
            number: "INV-001",
            status: "PAID",
            currency: "usd",
            subtotalCents: 2500,
            taxCents: 0,
            totalCents: 2500,
            balanceCents: 0,
            dueAt: now,
            issuedAt: now,
            paidAt: now,
            voidedAt: null,
            externalId: "stripe-inv-1",
            metadata: null
          }
        ],
        featureWarnings: [],
        metadata: null,
        lastUpdated: now
      }
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => overviewPayload
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchPortalBillingOverview("token-abc");

    expect(result.overview.organizationId).toBe("org-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.test/portal/billing/overview",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" })
      })
    );
  });

  it("includes organization headers when context is supplied", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ overview: { organizationId: "org-ctx" } })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchPortalBillingOverview("token-with-context", { organizationId: "org-ctx" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.test/portal/billing/overview",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-with-context",
          "X-Organization-Id": "org-ctx"
        })
      })
    );
  });

  it("posts subscription changes with auth headers preserved", async () => {
    const now = new Date().toISOString();
    const mockResponse = {
      subscription: {
        id: "sub-1",
        organizationId: "org-1",
        packageId: "pkg-pro",
        status: "ACTIVE",
        currency: "usd",
        amountCents: 2500,
        billingInterval: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: now,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        externalId: "stripe-sub-1",
        metadata: null,
        package: {
          id: "pkg-pro",
          slug: "pro",
          name: "Pro",
          description: "Pro plan",
          currency: "usd",
          interval: "MONTHLY",
          amountCents: 2500,
          trialPeriodDays: 14,
          featureLimits: []
        }
      },
      schedules: [
        {
          id: "sched-1",
          subscriptionId: "sub-1",
          targetPackageId: "pkg-pro-plus",
          status: "SCHEDULED",
          effectiveAt: now,
          metadata: null
        }
      ]
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => mockResponse
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const payload = { packageId: "pkg-pro-plus", timing: "immediate" as const };
    const result = await changePortalBillingSubscription("token-def", payload);

    expect(result.subscription.id).toBe("sub-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.test/portal/billing/subscription/change",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-def",
          "Content-Type": "application/json"
        })
      })
    );

    const body = fetchMock.mock.calls[0]?.[1];
    expect(body && typeof body === "object" && "body" in body ? JSON.parse(body.body as string) : null).toStrictEqual(
      payload
    );
  });

  it("fetches admin billing catalog with authorization header", async () => {
    const catalogResponse = {
      packages: [
        {
          id: "pkg-pro",
          slug: "pro",
          name: "Pro",
          description: "Pro plan",
          active: true,
          currency: "usd",
          interval: "MONTHLY",
          amountCents: 2500,
          trialPeriodDays: 14,
          metadata: null,
          featureLimits: []
        }
      ]
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => catalogResponse
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminBillingCatalog("token-xyz");

    expect(result.packages).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identity.test/super-admin/billing/packages",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-xyz" })
      })
    );
  });

  it("throws IdentityHttpError with rate-limit metadata", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === "retry-after" ? "120" : null)
      } as Headers,
      json: async () => ({ error: "rate_limited", message: "Try again later" })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = fetchPortalBillingOverview("token-rate-limited");
    await expect(promise).rejects.toBeInstanceOf(IdentityHttpError);

    await promise.catch((error) => {
      expect(error).toBeInstanceOf(IdentityHttpError);
      const typed = error as IdentityHttpError;
      expect(typed.status).toBe(429);
      expect(typed.code).toBe("rate_limited");
      expect(typed.retryAfter).toBe(120);
      expect(typed.message).toBe("Try again later");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
