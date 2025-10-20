import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTransaction } from "./prisma";

const supabaseListUsersMock = vi.fn();

vi.mock("./supabase", () => ({
  supabaseServiceClient: {
    auth: {
      admin: {
        listUsers: supabaseListUsersMock
      }
    }
  }
}));

const mockTx: Record<string, unknown> = {};

vi.mock("./prisma", async (original) => {
  const actual = await original<typeof import("./prisma")>();
  return {
    ...actual,
    withAuthorizationTransaction: vi.fn(async (_claims, callback) =>
      callback(mockTx as PrismaTransaction)
    )
  };
});

import {
  createBulkJobForSuperAdmin,
  createImpersonationSessionForSuperAdmin,
  getUserForSuperAdmin,
  listAuditLogsForSuperAdmin,
  listBulkJobsForSuperAdmin,
  listUsersForSuperAdmin,
  updateUserStatusForSuperAdmin
} from "./super-admin";

describe("super admin data access", () => {
  beforeEach(() => {
    mockTx.userProfile = {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    };
    mockTx.auditEvent = {
      count: vi.fn(),
      findMany: vi.fn()
    };
    mockTx.superAdminImpersonationToken = {
      create: vi.fn(),
      updateMany: vi.fn()
    };
    mockTx.superAdminBulkJob = {
      create: vi.fn(),
      findMany: vi.fn()
    };
    supabaseListUsersMock.mockReset();
  });

  it("lists users with aggregated metadata", async () => {
    const now = new Date();
    const countMock = (mockTx.userProfile as { count: ReturnType<typeof vi.fn> }).count;
    const findManyMock = (mockTx.userProfile as { findMany: ReturnType<typeof vi.fn> }).findMany;

    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      {
        userId: "user-1",
        email: "user@example.com",
        fullName: "User Example",
        createdAt: now,
        updatedAt: now,
        memberships: [
          {
            organizationId: "org-1",
            role: "ADMIN",
            organization: { id: "org-1", name: "Acme", slug: "acme" },
            tenantMemberships: [
              {
                tenantId: "tenant-1",
                role: "ADMIN",
                tenant: { id: "tenant-1", name: "Tenant One", slug: "tenant-one" }
              }
            ]
          }
        ],
        entitlements: [
          {
            id: "ent-1",
            organizationId: "org-1",
            tenantId: "tenant-1",
            tenant: { id: "tenant-1", name: "Tenant One", slug: "tenant-one" },
            productId: "prod-1",
            product: { id: "prod-1", slug: "tasks", name: "Tasks" },
            roles: ["ADMIN"],
            expiresAt: null,
            createdAt: now
          }
        ],
        auditEvents: [
          {
            id: "audit-1",
            eventType: "SIGN_IN",
            description: null,
            organizationId: "org-1",
            tenantId: null,
            productId: null,
            metadata: null,
            createdAt: now
          }
        ]
      }
    ]);

    const result = await listUsersForSuperAdmin(null, { page: 1, pageSize: 20 });

    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.id).toBe("user-1");
    expect(result.users[0]?.organizations[0]?.name).toBe("Acme");
    expect(result.users[0]?.tenantCount).toBe(1);
    expect(result.users[0]?.productSlugs).toEqual(["tasks"]);
    expect(result.hasNextPage).toBe(false);
  });

  it("returns detailed user information when available", async () => {
    const now = new Date();
    const findFirstMock = (mockTx.userProfile as { findFirst: ReturnType<typeof vi.fn> }).findFirst;

    findFirstMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      fullName: "User Example",
      createdAt: now,
      updatedAt: now,
      memberships: [
        {
          organizationId: "org-1",
          role: "ADMIN",
          organization: { id: "org-1", name: "Acme", slug: "acme" },
          tenantMemberships: [
            {
              tenantId: "tenant-1",
              role: "ADMIN",
              tenant: { id: "tenant-1", name: "Tenant One", slug: "tenant-one" }
            }
          ]
        }
      ],
      entitlements: [
        {
          id: "ent-1",
          organizationId: "org-1",
          tenantId: "tenant-1",
          tenant: { id: "tenant-1", name: "Tenant One", slug: "tenant-one" },
          productId: "prod-1",
          product: { id: "prod-1", slug: "tasks", name: "Tasks" },
          roles: ["ADMIN"],
          expiresAt: null,
          createdAt: now
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
          metadata: null,
          createdAt: now
        }
      ],
      samlAccounts: [
        {
          id: "saml-1",
          samlConnectionId: "saml-conn-1",
          connection: { id: "saml-conn-1", label: "Okta", organizationId: "org-1" },
          nameId: "user@example.com",
          email: "user@example.com",
          createdAt: now
        }
      ]
    });

    const result = await getUserForSuperAdmin(null, "user-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(result?.organizations[0]?.tenants[0]?.name).toBe("Tenant One");
    expect(result?.entitlements[0]?.productSlug).toBe("tasks");
    expect(result?.auditEvents).toHaveLength(1);
    expect(result?.samlAccounts[0]?.samlConnectionLabel).toBe("Okta");
  });

  it("allows lookup by verified email when userId metadata is missing", async () => {
    const findFirstMock = (mockTx.userProfile as { findFirst: ReturnType<typeof vi.fn> }).findFirst;

    findFirstMock.mockResolvedValueOnce({
      userId: "user-2",
      email: "user2@example.com",
      fullName: "User Two",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      memberships: [],
      entitlements: [],
      auditEvents: [],
      samlAccounts: []
    });

    const result = await getUserForSuperAdmin(null, "placeholder-id", "user2@example.com");
    expect(result?.email).toBe("user2@example.com");
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ email: "user2@example.com" })])
        })
      })
    );
  });

  it("hydrates a stub detail from Supabase when profile is missing but email matches", async () => {
    const findFirstMock = (mockTx.userProfile as { findFirst: ReturnType<typeof vi.fn> }).findFirst;
    findFirstMock.mockResolvedValue(null);

    const nowIso = new Date().toISOString();
    supabaseListUsersMock.mockResolvedValue({
      data: {
        users: [
          {
            id: "sup-2",
            email: "user2@example.com",
            created_at: nowIso,
            updated_at: nowIso,
            last_sign_in_at: null,
            email_confirmed_at: nowIso,
            user_metadata: { full_name: "Sup User" }
          }
        ]
      },
      error: null
    });

    const result = await getUserForSuperAdmin(null, "missing-id", "user2@example.com");
    expect(result?.id).toBe("sup-2");
    expect(result?.status).toBe("ACTIVE");
    expect(supabaseListUsersMock).toHaveBeenCalled();
  });

  it("returns null when user cannot be found", async () => {
    const findFirstMock = (mockTx.userProfile as { findFirst: ReturnType<typeof vi.fn> }).findFirst;
    findFirstMock.mockResolvedValue(null);

    const result = await getUserForSuperAdmin(null, "missing");
    expect(result).toBeNull();
  });

  it("lists audit logs with pagination", async () => {
    const countMock = (mockTx.auditEvent as { count: ReturnType<typeof vi.fn> }).count;
    const findManyMock = (mockTx.auditEvent as { findMany: ReturnType<typeof vi.fn> }).findMany;
    const now = new Date();

    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      {
        id: "audit-1",
        eventType: "ADMIN_ACTION",
        description: "Updated role",
        organizationId: "org-1",
        tenantId: null,
        productId: null,
        metadata: { actorEmail: "admin@example.com" },
        createdAt: now,
        actor: { email: "admin@example.com" }
      }
    ]);

    const result = await listAuditLogsForSuperAdmin(null, { page: 1, pageSize: 25 });

    expect(result.events).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(findManyMock).toHaveBeenCalled();
  });

  it("updates user status", async () => {
    const updateMock = (mockTx.userProfile as { update: ReturnType<typeof vi.fn> }).update;
    updateMock.mockResolvedValue({ status: "SUSPENDED" });

    const status = await updateUserStatusForSuperAdmin(null, { userId: "user-1", status: "SUSPENDED" });
    expect(status).toBe("SUSPENDED");
    expect(updateMock).toHaveBeenCalled();
  });

  it("creates impersonation session", async () => {
    const createMock = (mockTx.superAdminImpersonationToken as { create: ReturnType<typeof vi.fn> }).create;
    const now = new Date();
    createMock.mockResolvedValue({
      id: "token-1",
      token: "token",
      userId: "user-1",
      createdById: "admin-1",
      reason: null,
      productSlug: null,
      expiresAt: now,
      createdAt: now
    });

    const session = await createImpersonationSessionForSuperAdmin(null, {
      userId: "user-1",
      createdById: "admin-1",
      expiresAt: now
    });

    expect(session.tokenId).toBe("token-1");
    expect(createMock).toHaveBeenCalled();
  });

  it("creates bulk job summary", async () => {
    const createMock = (mockTx.superAdminBulkJob as { create: ReturnType<typeof vi.fn> }).create;
    const now = new Date();
    createMock.mockResolvedValue({
      id: "job-1",
      action: "SUSPEND_USERS",
      status: "SUCCEEDED",
      userIds: ["user-1"],
      reason: null,
      totalCount: 1,
      completedCount: 1,
      failedCount: 0,
      errorMessage: null,
      initiatedById: "admin-1",
      initiatedBy: { userId: "admin-1", email: "admin@example.com" },
      createdAt: now,
      updatedAt: now
    });

    const job = await createBulkJobForSuperAdmin(null, {
      action: "SUSPEND_USERS",
      userIds: ["user-1"],
      initiatedById: "admin-1"
    });

    expect(job.id).toBe("job-1");
    expect(job.status).toBe("SUCCEEDED");
  });

  it("lists bulk jobs", async () => {
    const findManyMock = (mockTx.superAdminBulkJob as { findMany: ReturnType<typeof vi.fn> }).findMany;
    const now = new Date();
    findManyMock.mockResolvedValue([
      {
        id: "job-1",
        action: "EXPORT_USERS",
        status: "SUCCEEDED",
        totalCount: 2,
        completedCount: 2,
        failedCount: 0,
        errorMessage: null,
        reason: null,
        initiatedBy: { userId: "admin-1", email: "admin@example.com" },
        createdAt: now,
        updatedAt: now
      }
    ]);

    const jobs = await listBulkJobsForSuperAdmin(null);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.action).toBe("EXPORT_USERS");
  });
});
