import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTasksContext } from "./http";

describe("fetchTasksContext", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches and validates the tasks context response", async () => {
    const mockResponse = {
      user: {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One"
      },
      organization: {
        id: "org-1",
        name: "Organization",
        slug: "organization"
      },
      product: {
        id: "prod-1",
        slug: "tasks",
        name: "Tasks"
      },
      entitlements: [
        {
          id: "ent-1",
          productId: "prod-1",
          productSlug: "tasks",
          tenantId: "tenant-1",
          tenantName: "Primary",
          roles: ["ADMIN"],
          expiresAt: null
        }
      ],
      tenants: [
        {
          id: "tenant-1",
          name: "Primary",
          slug: "primary",
          description: null,
          membersCount: 1,
          productsCount: 1
        }
      ],
      activeTenant: {
        entitlementId: "ent-1",
        tenantId: "tenant-1",
        tenantName: "Primary",
        roles: ["ADMIN"],
        source: "fallback"
      }
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => mockResponse
    })) as unknown as typeof fetch;

    globalThis.fetch = fetchMock;

    const result = await fetchTasksContext("test-token", { tenantId: "tenant-1" });

    expect(result.activeTenant.tenantId).toBe("tenant-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/internal/tasks/context?tenantId=tenant-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" })
      })
    );
  });
});
