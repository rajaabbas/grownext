import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSuperAdminUserDetail,
  fetchSuperAdminUsers,
  fetchTasksContext,
  fetchTasksUsers,
  updateSuperAdminOrganizationRole,
  updateSuperAdminTenantRole,
  grantSuperAdminEntitlement,
  revokeSuperAdminEntitlement,
  updateSuperAdminUserStatus,
  createSuperAdminImpersonationSession,
  deleteSuperAdminImpersonationSession,
  createSuperAdminBulkJob,
  updateSuperAdminBulkJob,
  fetchSuperAdminBulkJobs,
  fetchSuperAdminAuditLogs,
  createSuperAdminAuditExport,
  cleanupSuperAdminImpersonationSessions
} from "./http";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchTasksContext", () => {

  it("fetches and validates the tasks context response", async () => {
    const timestamp = new Date().toISOString();
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
      },
      projects: [
        {
          id: "project-1",
          tenantId: "tenant-1",
          name: "Growth",
          description: null,
          color: null,
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      projectSummaries: [
        {
          projectId: null,
          name: "All Tasks",
          openCount: 1,
          overdueCount: 0,
          completedCount: 0,
          scope: "all"
        }
      ],
      permissions: {
        roles: ["ADMIN"],
        effective: {
          canView: true,
          canCreate: true,
          canEdit: true,
          canComment: true,
          canAssign: true,
          canManage: true
        }
      }
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => mockResponse
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

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
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

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

  it("fetches all task users when no ids are supplied", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        users: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchTasksUsers("token", { tenantId: "tenant-1" });

    expect(result.users).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/internal/tasks/users?tenantId=tenant-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" })
      })
    );
  });
});

describe("fetchSuperAdminUsers", () => {
  it("fetches and validates super admin user summaries", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        users: [
          {
            id: "user-1",
            email: "user@example.com",
            fullName: "User Example",
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            lastActivityAt: now,
            organizations: [
              {
                id: "org-1",
                name: "Acme",
                slug: "acme",
                role: "ADMIN"
              }
            ],
            tenantCount: 1,
            productSlugs: ["tasks"],
            productCount: 1
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchSuperAdminUsers("token", { search: "user", page: 1 });

    expect(result.users[0]?.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users?search=user&page=1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" })
      })
    );
  });

  it("appends status filters when provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        users: [],
        pagination: {
          page: 2,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true
        }
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchSuperAdminUsers("token", { status: "SUSPENDED", page: 2 });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3100/super-admin/users?status=SUSPENDED&page=2",
      expect.anything()
    );
  });
});

describe("fetchSuperAdminUserDetail", () => {
  it("fetches and validates user detail", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchSuperAdminUserDetail("token", "user-1");

    expect(result.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" })
      })
    );
  });
});

describe("updateSuperAdminOrganizationRole", () => {
  it("sends a PATCH request and returns updated detail", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await updateSuperAdminOrganizationRole("token", "user-1", "org-1", { role: "ADMIN" });

    expect(result.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/organizations/org-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});

describe("updateSuperAdminTenantRole", () => {
  it("sends a PATCH request for tenant membership", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await updateSuperAdminTenantRole("token", "user-1", "org-1", "tenant-1", { role: "ADMIN" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/organizations/org-1/tenants/tenant-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});

describe("grantSuperAdminEntitlement", () => {
  it("POSTs the entitlement request and returns detail", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await grantSuperAdminEntitlement("token", "user-1", {
      organizationId: "org-1",
      tenantId: "tenant-1",
      productId: "prod-1",
      roles: ["ADMIN"]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/entitlements",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("revokeSuperAdminEntitlement", () => {
  it("DELETEs the entitlement request and returns detail", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await revokeSuperAdminEntitlement("token", "user-1", {
      organizationId: "org-1",
      tenantId: "tenant-1",
      productId: "prod-1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/entitlements",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("updateSuperAdminUserStatus", () => {
  it("PATCHes status updates and returns detail", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        status: "SUSPENDED",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        organizations: [],
        entitlements: [],
        auditEvents: [],
        samlAccounts: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const detail = await updateSuperAdminUserStatus("token", "user-1", {
      status: "SUSPENDED",
      reason: "Manual review"
    });

    expect(detail.status).toBe("SUSPENDED");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/status",
      expect.objectContaining({ method: "PATCH" })
    );
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastCall).toBeDefined();
    const [, requestInit] = (lastCall as unknown as Parameters<typeof fetch>);
    const init = (requestInit ?? {}) as RequestInit;
    const parsedBody = JSON.parse((init.body as string) ?? "{}");
    expect(parsedBody).toEqual({
      status: "SUSPENDED",
      reason: "Manual review"
    });
  });
});

describe("createSuperAdminImpersonationSession", () => {
  it("creates a short-lived impersonation token", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tokenId: "token-1",
        url: "https://admin.grownext.dev/impersonate?token=token-1",
        expiresAt: now,
        createdAt: now
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await createSuperAdminImpersonationSession("token", "user-1", {
      expiresInMinutes: 15
    });

    expect(response.tokenId).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/impersonation",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("deleteSuperAdminImpersonationSession", () => {
  it("stops an active impersonation session", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({})
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await deleteSuperAdminImpersonationSession("token", "user-1", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/users/user-1/impersonation/session-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("treats missing sessions as success", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: "not_found" })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      deleteSuperAdminImpersonationSession("token", "user-1", "missing")
    ).resolves.toBeUndefined();
  });
});

describe("cleanupSuperAdminImpersonationSessions", () => {
  it("cleans expired sessions", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        removed: 2,
        sessions: []
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await cleanupSuperAdminImpersonationSessions("token");

    expect(response.removed).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/impersonation/cleanup",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("createSuperAdminBulkJob", () => {
  it("submits a bulk job request", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "job-1",
        action: "ACTIVATE_USERS",
        status: "PENDING",
        totalCount: 2,
        completedCount: 0,
        failedCount: 0,
        createdAt: now,
        updatedAt: now,
        initiatedBy: { id: "admin-1", email: "admin@example.com" },
        errorMessage: null,
        reason: null,
        progressMessage: null,
        progressUpdatedAt: null,
        failureDetails: [],
        resultUrl: null,
        resultExpiresAt: null
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const job = await createSuperAdminBulkJob("token", {
      action: "ACTIVATE_USERS",
      userIds: ["user-1", "user-2"]
    });

    expect(job.id).toBe("job-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/bulk-jobs",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("updateSuperAdminBulkJob", () => {
  it("updates bulk job progress", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "job-1",
        action: "ACTIVATE_USERS",
        status: "RUNNING",
        totalCount: 2,
        completedCount: 1,
        failedCount: 0,
        createdAt: now,
        updatedAt: now,
        initiatedBy: { id: "admin-1", email: "admin@example.com" },
        errorMessage: null,
        reason: null,
        progressMessage: "Processing",
        progressUpdatedAt: now,
        failureDetails: [],
        resultUrl: null,
        resultExpiresAt: null
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const job = await updateSuperAdminBulkJob("token", "job-1", {
      status: "RUNNING",
      completedCount: 1,
      progressMessage: "Processing"
    });

    expect(job.status).toBe("RUNNING");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/bulk-jobs/job-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});

describe("fetchSuperAdminBulkJobs", () => {
  it("retrieves bulk job summaries", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: "job-1",
            action: "SUSPEND_USERS",
            status: "RUNNING",
            totalCount: 5,
            completedCount: 2,
            failedCount: 0,
            createdAt: now,
            updatedAt: now,
            initiatedBy: { id: "admin-1", email: "admin@example.com" },
            errorMessage: null,
            reason: null,
            progressMessage: null,
            progressUpdatedAt: null,
            failureDetails: [],
            resultUrl: null,
            resultExpiresAt: null
          }
        ]
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchSuperAdminBulkJobs("token");

    expect(result.jobs).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/bulk-jobs",
      expect.anything()
    );
  });
});

describe("fetchSuperAdminAuditLogs", () => {
  it("supports query parameters", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "event-1",
            eventType: "USER_SUSPENDED",
            description: "Suspended for testing",
            organizationId: "org-1",
            tenantId: null,
            productId: null,
            metadata: { userId: "user-1" },
            createdAt: now
          }
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await fetchSuperAdminAuditLogs("token", {
      actorEmail: "admin@example.com",
      eventType: "USER_SUSPENDED",
      page: 2
    });

    expect(response.pagination.page).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/audit/logs?actorEmail=admin%40example.com&eventType=USER_SUSPENDED&page=2",
      expect.anything()
    );
  });
});

describe("createSuperAdminAuditExport", () => {
  it("requests an export link", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        url: "https://storage.grownext.dev/audit.csv",
        expiresAt: now
      })
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const exportResponse = await createSuperAdminAuditExport("token", {
      search: "user-1",
      pageSize: 100
    });

    expect(exportResponse.url).toContain("audit.csv");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3100/super-admin/audit/export",
      expect.objectContaining({ method: "POST" })
    );
  });
});
