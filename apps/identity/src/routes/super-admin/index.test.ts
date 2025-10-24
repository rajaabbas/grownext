import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseJwtClaims } from "@ma/core";
import type { SuperAdminUsersResponse, SuperAdminUserDetail } from "@ma/contracts";

const dbMocks = vi.hoisted(() => ({
  listUsersForSuperAdmin: vi.fn(),
  getUserForSuperAdmin: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
  updateTenantMemberRole: vi.fn(),
  grantEntitlement: vi.fn(),
  revokeEntitlement: vi.fn(),
  recordAuditEvent: vi.fn(),
  updateUserStatusForSuperAdmin: vi.fn(),
  createImpersonationSessionForSuperAdmin: vi.fn(),
  stopImpersonationSessionForSuperAdmin: vi.fn(),
  cleanupExpiredImpersonationSessionsForSuperAdmin: vi.fn(),
  createBulkJobForSuperAdmin: vi.fn(),
  listBulkJobsForSuperAdmin: vi.fn(),
  updateBulkJobForSuperAdmin: vi.fn(),
  getBulkJobByIdForSuperAdmin: vi.fn(),
  listAuditLogsForSuperAdmin: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

import type { IdentityQueues } from "../../lib/queues";
import superAdminRoutes from "./index";

const buildServer = async (claims: SupabaseJwtClaims | null) => {
  const server = Fastify();
  server.decorateRequest("supabaseClaims", null);
  const queueMocks = {
    identityEvents: { name: "identity-events" } as unknown,
    userManagement: { name: "user-management" } as unknown,
    superAdminBulkJobs: { name: "super-admin-bulk-jobs" } as unknown,
    billingUsage: { name: "billing-usage" } as unknown,
    billingInvoice: { name: "billing-invoice" } as unknown,
    billingPaymentSync: { name: "billing-payment-sync" } as unknown,
    close: vi.fn().mockResolvedValue(undefined),
    emitIdentityEvent: vi.fn().mockResolvedValue(undefined),
    emitUserManagementJob: vi.fn().mockResolvedValue(undefined),
    emitSuperAdminBulkJob: vi.fn().mockResolvedValue(undefined),
    emitBillingUsageJob: vi.fn().mockResolvedValue(undefined),
    emitBillingInvoiceJob: vi.fn().mockResolvedValue(undefined),
    emitBillingPaymentSyncJob: vi.fn().mockResolvedValue(undefined),
    broadcastSuperAdminBulkJobStatus: vi.fn().mockResolvedValue(undefined)
  } as IdentityQueues;
  server.decorate("queues", queueMocks);
  server.addHook("preHandler", async (request) => {
    request.supabaseClaims = claims;
  });
  await server.register(superAdminRoutes, { prefix: "/super-admin" });
  return server;
};

describe("super admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const nowIso = new Date().toISOString();
    dbMocks.recordAuditEvent.mockResolvedValue({});
    dbMocks.updateUserStatusForSuperAdmin.mockResolvedValue("ACTIVE");
    dbMocks.getUserForSuperAdmin.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      organizations: [],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    });
    dbMocks.createImpersonationSessionForSuperAdmin.mockResolvedValue({
      tokenId: "token-1",
      token: "token",
      userId: "user-1",
      createdById: "admin-1",
      expiresAt: nowIso,
      createdAt: nowIso,
      reason: null,
      productSlug: null
    });
    dbMocks.stopImpersonationSessionForSuperAdmin.mockResolvedValue({
      tokenId: "token-1",
      token: "token",
      userId: "user-1",
      createdById: "admin-1",
      expiresAt: nowIso,
      createdAt: nowIso,
      reason: null,
      productSlug: null
    });
    dbMocks.cleanupExpiredImpersonationSessionsForSuperAdmin.mockResolvedValue([]);
    dbMocks.listBulkJobsForSuperAdmin.mockResolvedValue([]);
    dbMocks.createBulkJobForSuperAdmin.mockResolvedValue({
      id: "job-1",
      action: "SUSPEND_USERS",
      status: "SUCCEEDED",
      totalCount: 1,
      completedCount: 1,
      failedCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      initiatedBy: { id: "admin-1", email: "admin@example.com" },
      errorMessage: null,
      reason: null,
      progressMessage: null,
      progressUpdatedAt: null,
      failureDetails: [],
      resultUrl: null,
      resultExpiresAt: null
    });
    dbMocks.getBulkJobByIdForSuperAdmin.mockResolvedValue({
      id: "job-1",
      action: "SUSPEND_USERS",
      status: "PENDING",
      totalCount: 1,
      completedCount: 0,
      failedCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      initiatedBy: { id: "admin-1", email: "admin@example.com" },
      errorMessage: null,
      reason: null,
      progressMessage: null,
      progressUpdatedAt: null,
      failureDetails: [],
      resultUrl: null,
      resultExpiresAt: null,
      userIds: ["user-1"]
    });
    dbMocks.updateBulkJobForSuperAdmin.mockImplementation(async (_claims, input) => ({
      id: input.jobId,
      action: "SUSPEND_USERS",
      status: input.status ?? "PENDING",
      totalCount: 1,
      completedCount: input.completedCount ?? 0,
      failedCount: input.failedCount ?? 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      initiatedBy: { id: "admin-1", email: "admin@example.com" },
      errorMessage: input.errorMessage ?? null,
      reason: null,
      progressMessage: input.progressMessage ?? null,
      progressUpdatedAt: input.progressUpdatedAt
        ? input.progressUpdatedAt instanceof Date
          ? input.progressUpdatedAt.toISOString()
          : input.progressUpdatedAt
        : null,
      failureDetails: Array.isArray(input.failureDetails) ? input.failureDetails : [],
      resultUrl: input.resultUrl ?? null,
      resultExpiresAt:
        input.resultExpiresAt instanceof Date
          ? input.resultExpiresAt.toISOString()
          : (input.resultExpiresAt as string | null | undefined) ?? null
    }));
    dbMocks.listAuditLogsForSuperAdmin.mockResolvedValue({
      events: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });
    dbMocks.grantEntitlement.mockResolvedValue({
      id: "ent-99",
      organizationId: "org-1",
      tenantId: "tenant-1",
      productId: "prod-1",
      userId: "user-1",
      roles: ["ADMIN"],
      createdAt: new Date(nowIso),
      updatedAt: new Date(nowIso)
    } as never);
    dbMocks.revokeEntitlement.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated requests", async () => {
    const server = await buildServer(null);
    try {
      const response = await server.inject({ method: "GET", url: "/super-admin/users" });
      expect(response.statusCode).toBe(401);
    } finally {
      await server.close();
    }
  });

  it("rejects users without the required role", async () => {
    const server = await buildServer({
      sub: "user-1",
      email: "user@example.com",
      user_metadata: { roles: ["member"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({ method: "GET", url: "/super-admin/users" });
      expect(response.statusCode).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("returns user summaries for super admins", async () => {
    const nowIso = new Date().toISOString();
    dbMocks.listUsersForSuperAdmin.mockResolvedValue({
      users: [
        {
          id: "user-1",
          email: "user@example.com",
          fullName: "User Example",
          status: "ACTIVE",
          createdAt: nowIso,
          updatedAt: nowIso,
          lastActivityAt: nowIso,
          organizations: [
            {
              id: "org-1",
              name: "Acme",
              slug: "acme",
              role: "ADMIN"
            }
          ],
          tenantCount: 2,
          productSlugs: ["tasks"],
          productCount: 1
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({ method: "GET", url: "/super-admin/users" });
      expect(response.statusCode).toBe(200);
      const payload = response.json() as SuperAdminUsersResponse;
      expect(payload.users).toHaveLength(1);
      expect(payload.pagination.total).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("returns user detail when available", async () => {
    const nowIso = new Date().toISOString();
    dbMocks.getUserForSuperAdmin.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      organizations: [
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          role: "ADMIN",
          tenants: [
            {
              id: "tenant-1",
              name: "Tenant One",
              slug: "tenant-one",
              role: "ADMIN"
            }
          ]
        }
      ],
      entitlements: [
        {
          id: "ent-1",
          organizationId: "org-1",
          tenantId: "tenant-1",
          tenantName: "Tenant One",
          productId: "prod-1",
          productSlug: "tasks",
          productName: "Tasks",
          roles: ["ADMIN"],
          expiresAt: null,
          createdAt: nowIso
        }
      ],
      auditEvents: [
        {
          id: "audit-1",
          eventType: "SIGN_IN",
          description: "Signed in",
          organizationId: "org-1",
          tenantId: null,
          productId: null,
          actorEmail: "admin@example.com",
          ipAddress: "198.51.100.1",
          userAgent: "vitest",
          metadata: null,
          createdAt: nowIso
        }
      ],
      samlAccounts: [
        {
          id: "saml-1",
          samlConnectionId: "saml-conn-1",
          samlConnectionLabel: "Okta",
          nameId: "user@example.com",
          email: "user@example.com",
          createdAt: nowIso
        }
      ]
    } satisfies SuperAdminUserDetail);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      user_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "GET",
        url: "/super-admin/users/user-1"
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json() as SuperAdminUserDetail;
      expect(payload.id).toBe("user-1");
      expect(payload.organizations[0]?.tenants[0]?.name).toBe("Tenant One");
    } finally {
      await server.close();
    }
  });

  it("returns 404 when user detail is missing", async () => {
    dbMocks.getUserForSuperAdmin.mockResolvedValue(null);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "GET",
        url: "/super-admin/users/user-2"
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("updates organization member role", async () => {
    const nowIso = new Date().toISOString();
    dbMocks.updateOrganizationMemberRole.mockResolvedValue({
      organizationId: "org-1",
      userId: "user-1",
      role: "ADMIN"
    });
    dbMocks.getUserForSuperAdmin.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      organizations: [
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          role: "ADMIN",
          tenants: []
        }
      ],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    } satisfies SuperAdminUserDetail);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/super-admin/users/user-1/organizations/org-1",
        payload: { role: "ADMIN" }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.updateOrganizationMemberRole).toHaveBeenCalled();
      expect(dbMocks.recordAuditEvent).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("returns 404 when tenant membership is missing", async () => {
    dbMocks.updateTenantMemberRole.mockResolvedValue(null);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/super-admin/users/user-1/organizations/org-1/tenants/tenant-1",
        payload: { role: "ADMIN" }
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("grants entitlements for super admins", async () => {
    const nowIso = new Date().toISOString();
    dbMocks.getUserForSuperAdmin.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      organizations: [],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    } satisfies SuperAdminUserDetail);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/super-admin/users/user-1/entitlements",
        payload: {
          organizationId: "org-1",
          tenantId: "tenant-1",
          productId: "prod-1",
          roles: ["ADMIN"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.grantEntitlement).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("revokes entitlements for super admins", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "DELETE",
        url: "/super-admin/users/user-1/entitlements",
        payload: {
          organizationId: "org-1",
          tenantId: "tenant-1",
          productId: "prod-1"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.revokeEntitlement).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("updates user status", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/super-admin/users/user-1/status",
        payload: { status: "SUSPENDED" }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.updateUserStatusForSuperAdmin).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("creates impersonation session", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/super-admin/users/user-1/impersonation",
        payload: { reason: "Support investigation" }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.createImpersonationSessionForSuperAdmin).toHaveBeenCalled();
      expect(response.json().url).toContain("impersonate");
    } finally {
      await server.close();
    }
  });

  it("stops impersonation session", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "DELETE",
        url: "/super-admin/users/user-1/impersonation/token-1"
      });

      expect(response.statusCode).toBe(204);
      expect(dbMocks.stopImpersonationSessionForSuperAdmin).toHaveBeenCalledWith(
        expect.anything(),
        "token-1"
      );
    } finally {
      await server.close();
    }
  });

  it("forbids impersonation cleanup without service role", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/super-admin/impersonation/cleanup"
      });

      expect(response.statusCode).toBe(403);
      expect(dbMocks.cleanupExpiredImpersonationSessionsForSuperAdmin).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("cleans expired impersonation sessions when invoked by service role", async () => {
    dbMocks.cleanupExpiredImpersonationSessionsForSuperAdmin.mockResolvedValue([
      {
        tokenId: "token-1",
        userId: "user-1",
        createdById: "admin-1",
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reason: null,
        productSlug: null
      }
    ]);

    const server = await buildServer({
      role: "service_role"
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/super-admin/impersonation/cleanup"
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.cleanupExpiredImpersonationSessionsForSuperAdmin).toHaveBeenCalled();
      expect(response.json().removed).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("lists bulk jobs", async () => {
    dbMocks.listBulkJobsForSuperAdmin.mockResolvedValue([
      {
        id: "job-1",
        action: "EXPORT_USERS",
        status: "SUCCEEDED",
        totalCount: 1,
        completedCount: 1,
        failedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        initiatedBy: { id: "admin-1", email: "admin@example.com" },
        errorMessage: null,
        reason: null,
        progressMessage: null,
        progressUpdatedAt: null,
        failureDetails: [],
        resultUrl: null,
        resultExpiresAt: null
      }
    ]);

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({ method: "GET", url: "/super-admin/bulk-jobs" });
      expect(response.statusCode).toBe(200);
      expect(response.json().jobs).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("creates bulk job", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/super-admin/bulk-jobs",
        payload: { action: "SUSPEND_USERS", userIds: ["user-1"] }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.createBulkJobForSuperAdmin).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("retries bulk job", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/super-admin/bulk-jobs/job-1",
        payload: { action: "retry" }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.updateBulkJobForSuperAdmin).toHaveBeenCalled();
      expect(dbMocks.getBulkJobByIdForSuperAdmin).toHaveBeenCalledWith(
        expect.anything(),
        "job-1"
      );
      const queues = (server as unknown as {
        queues: {
          emitSuperAdminBulkJob: ReturnType<typeof vi.fn>;
          broadcastSuperAdminBulkJobStatus: ReturnType<typeof vi.fn>;
        };
      }).queues;
      expect(queues.emitSuperAdminBulkJob).toHaveBeenCalled();
      expect(queues.broadcastSuperAdminBulkJobStatus).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("updates bulk job progress", async () => {
    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/super-admin/bulk-jobs/job-1",
        payload: { status: "RUNNING", completedCount: 1 }
      });

      expect(response.statusCode).toBe(200);
      expect(dbMocks.updateBulkJobForSuperAdmin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ jobId: "job-1", status: "RUNNING", completedCount: 1 })
      );
      const queues = (server as unknown as {
        queues: {
          broadcastSuperAdminBulkJobStatus: ReturnType<typeof vi.fn>;
        };
      }).queues;
      expect(queues.broadcastSuperAdminBulkJobStatus).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("returns audit logs", async () => {
    dbMocks.listAuditLogsForSuperAdmin.mockResolvedValue({
      events: [
        {
          id: "audit-1",
          eventType: "ADMIN_ACTION",
          description: "Updated user",
          organizationId: "org-1",
          tenantId: null,
          productId: null,
          actorEmail: "admin@example.com",
          ipAddress: "203.0.113.5",
          userAgent: "vitest",
          metadata: { actorEmail: "admin@example.com" },
          createdAt: new Date().toISOString()
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
    });

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({ method: "GET", url: "/super-admin/audit/logs" });
      expect(response.statusCode).toBe(200);
      expect(dbMocks.listAuditLogsForSuperAdmin).toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("exports audit logs", async () => {
    dbMocks.listAuditLogsForSuperAdmin.mockResolvedValue({
      events: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });

    const server = await buildServer({
      sub: "admin-1",
      email: "admin@example.com",
      app_metadata: { roles: ["super-admin"] }
    } as SupabaseJwtClaims);

    try {
      const response = await server.inject({ method: "POST", url: "/super-admin/audit/export" });
      expect(response.statusCode).toBe(200);
      expect(response.json().url).toMatch(/^data:text\/csv/);
    } finally {
      await server.close();
    }
  });
});
