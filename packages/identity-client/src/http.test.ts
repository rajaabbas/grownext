import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTasksContext, fetchTasksUsers } from "./http";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchTasksContext", () => {

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

describe("fetchTasksUsers", () => {
  it("returns an empty result when no user ids are provided", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchTasksUsers("token", { userIds: [] });

    expect(result.users).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches and validates user summaries", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        users: [
          {
            id: "user-1",
            email: "owner@example.com",
            fullName: "Owner Name"
          }
        ]
      })
    })) as unknown as typeof fetch;

    globalThis.fetch = fetchMock;

    const result = await fetchTasksUsers("test-token", {
      userIds: ["user-1"],
      tenantId: "tenant-1"
    });

    expect(result.users[0]?.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/internal/tasks/users?userId=user-1&tenantId=tenant-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" })
      })
    );
  });
});
