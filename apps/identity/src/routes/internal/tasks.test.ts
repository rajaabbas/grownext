import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseJwtClaims } from "@ma/core";
import type { TasksContextResponse } from "@ma/contracts";
import type { PrismaTransaction } from "@ma/db";

const dbMocks = vi.hoisted(() => ({
  getOrganizationById: vi.fn(),
  listEntitlementsForUser: vi.fn(),
  listEntitlementsForTenant: vi.fn(),
  listEntitlementsForOrganization: vi.fn(),
  listTenantSummariesForOrganization: vi.fn(),
  listTenantMembershipsForUser: vi.fn(),
  withAuthorizationTransaction: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

const tasksDbMocks = vi.hoisted(() => ({
  listProjectsForTenant: vi.fn(),
  listProjectSummariesForTenant: vi.fn(),
  listPermissionPoliciesForUser: vi.fn(),
  buildTaskPermissionEvaluator: vi.fn().mockImplementation(
    ({ identityRoles }: { identityRoles: string[] }) => {
      const hasAdmin = identityRoles.includes("ADMIN") || identityRoles.includes("tasks:admin");
      return (action: string) => {
        if (hasAdmin) {
          return true;
        }
        return action === "view" || action === "comment";
      };
    }
  )
}));

vi.mock("@ma/tasks-db", () => tasksDbMocks);

import internalTasksRoutes from "./tasks";

describe("internal tasks routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tasksDbMocks.listProjectsForTenant.mockReset();
    tasksDbMocks.listProjectSummariesForTenant.mockReset();
    tasksDbMocks.listPermissionPoliciesForUser.mockReset();
    tasksDbMocks.buildTaskPermissionEvaluator.mockReset();
    tasksDbMocks.buildTaskPermissionEvaluator.mockImplementation(
      ({ identityRoles }: { identityRoles: string[] }) => {
        const hasAdmin =
          identityRoles.includes("ADMIN") || identityRoles.includes("tasks:admin");
        return (action: string) => {
          if (hasAdmin) {
            return true;
          }
          return action === "view" || action === "comment";
        };
      }
    );
  });

  const buildServer = async () => {
    const server = Fastify();
    server.decorateRequest("supabaseClaims", null);
    server.addHook("preHandler", async (request) => {
      request.supabaseClaims = {
        sub: "user-1",
        email: "user@example.com",
        organization_id: "org-1",
        user_metadata: { full_name: "User One" }
      } as SupabaseJwtClaims;
    });
    await server.register(internalTasksRoutes, { prefix: "/internal/tasks" });
    return server;
  };

  it("returns tenancy context for the authenticated user", async () => {
    const server = await buildServer();
    const now = new Date();

    dbMocks.getOrganizationById.mockResolvedValue({
      id: "org-1",
      name: "Organization",
      slug: "organization",
      createdAt: now,
      updatedAt: now
    });

    dbMocks.listTenantSummariesForOrganization.mockResolvedValue([
      {
        id: "tenant-1",
        organizationId: "org-1",
        name: "Primary Tenant",
        slug: "primary",
        description: null,
        membersCount: 2,
        productsCount: 1
      }
    ]);

    dbMocks.listTenantMembershipsForUser.mockResolvedValue([
      { tenantId: "tenant-1", role: "ADMIN" }
    ]);

    dbMocks.listEntitlementsForUser.mockResolvedValue([
      {
        id: "ent-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-1",
        roles: ["ADMIN"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: "http://tasks.localhost",
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      },
      {
        id: "ent-expired",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-1",
        roles: ["MEMBER"],
        expiresAt: new Date(Date.now() - 3600_000),
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: "http://tasks.localhost",
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      }
    ]);

    dbMocks.listTenantMembershipsForUser.mockResolvedValue([
      { tenantId: "tenant-1", role: "ADMIN" }
    ]);

    tasksDbMocks.listProjectsForTenant.mockResolvedValue([
      {
        id: "project-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        name: "Growth",
        description: null,
        color: "#ff00ff",
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      }
    ]);

    tasksDbMocks.listProjectSummariesForTenant.mockResolvedValue([
      {
        projectId: null,
        name: "All Tasks",
        openCount: 2,
        overdueCount: 0,
        completedCount: 0,
        scope: "all"
      },
      {
        projectId: "project-1",
        name: "Growth",
        openCount: 2,
        overdueCount: 0,
        completedCount: 0,
        scope: "project"
      }
    ]);

    tasksDbMocks.listPermissionPoliciesForUser.mockResolvedValue([]);

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/context"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as TasksContextResponse;
    expect(payload.organization.id).toBe("org-1");
    expect(payload.entitlements).toHaveLength(1);
    expect(payload.entitlements[0]?.roles).toEqual(["ADMIN"]);
    expect(payload.activeTenant.tenantId).toBe("tenant-1");
    expect(payload.activeTenant.roles).toEqual(["ADMIN"]);
    expect(payload.activeTenant.source).toBe("fallback");
    expect(payload.projects).toHaveLength(1);
    expect(payload.projects[0]?.name).toBe("Growth");
    expect(payload.projectSummaries.find((summary) => summary.scope === "all")).toBeTruthy();
    expect(payload.permissions.effective.canManage).toBe(true);

    await server.close();
  });

  it("returns 403 when the user lacks tasks entitlements", async () => {
    const server = await buildServer();
    const now = new Date();

    dbMocks.getOrganizationById.mockResolvedValue({
      id: "org-1",
      name: "Organization",
      slug: "organization",
      createdAt: now,
      updatedAt: now
    });

    dbMocks.listTenantSummariesForOrganization.mockResolvedValue([]);
    dbMocks.listEntitlementsForUser.mockResolvedValue([
      {
        id: "ent-2",
        organizationId: "org-1",
        tenantId: "tenant-2",
        productId: "prod-2",
        userId: "user-1",
        roles: ["MEMBER"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-2",
          slug: "other-product",
          name: "Other",
          description: null,
          iconUrl: null,
          launcherUrl: null,
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      }
    ]);

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/context"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "tasks_product_access_required" });

    await server.close();
  });

  it("respects an explicit tenant query parameter", async () => {
    const server = await buildServer();
    const now = new Date();

    dbMocks.getOrganizationById.mockResolvedValue({
      id: "org-1",
      name: "Organization",
      slug: "organization",
      createdAt: now,
      updatedAt: now
    });

    dbMocks.listTenantSummariesForOrganization.mockResolvedValue([
      {
        id: "tenant-1",
        organizationId: "org-1",
        name: "Tenant One",
        slug: "tenant-one",
        description: null,
        membersCount: 2,
        productsCount: 1
      },
      {
        id: "tenant-2",
        organizationId: "org-1",
        name: "Tenant Two",
        slug: "tenant-two",
        description: null,
        membersCount: 1,
        productsCount: 1
      }
    ]);

    dbMocks.listEntitlementsForUser.mockResolvedValue([
      {
        id: "ent-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-1",
        roles: ["ADMIN"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: "http://tasks.localhost",
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      },
      {
        id: "ent-2",
        organizationId: "org-1",
        tenantId: "tenant-2",
        productId: "prod-1",
        userId: "user-1",
        roles: ["MEMBER"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: "http://tasks.localhost",
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      }
    ]);

    dbMocks.listTenantMembershipsForUser.mockResolvedValue([
      { tenantId: "tenant-1", role: "ADMIN" },
      { tenantId: "tenant-2", role: "MEMBER" }
    ]);

    tasksDbMocks.listProjectsForTenant.mockResolvedValue([
      {
        id: "project-2",
        organizationId: "org-1",
        tenantId: "tenant-2",
        name: "Expansion",
        description: null,
        color: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now
      }
    ]);

    tasksDbMocks.listProjectSummariesForTenant.mockResolvedValue([
      {
        projectId: null,
        name: "All Tasks",
        openCount: 1,
        overdueCount: 0,
        completedCount: 0,
        scope: "all"
      },
      {
        projectId: "project-2",
        name: "Expansion",
        openCount: 1,
        overdueCount: 0,
        completedCount: 0,
        scope: "project"
      }
    ]);

    tasksDbMocks.listPermissionPoliciesForUser.mockResolvedValue([]);

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/context?tenantId=tenant-2"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.activeTenant.tenantId).toBe("tenant-2");
    expect(payload.activeTenant.source).toBe("request");
    expect(payload.activeTenant.roles).toEqual(["MEMBER"]);

    await server.close();
  });

  it("returns user summaries for organization members", async () => {
    const server = await buildServer();
    const now = new Date();

    dbMocks.listEntitlementsForUser.mockResolvedValue([
      {
        id: "ent-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-1",
        roles: ["ADMIN"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: null,
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      }
    ]);

    dbMocks.withAuthorizationTransaction.mockImplementationOnce(async (_claims, callback) => {
      const tx = {
        organizationMember: {
          findMany: async () => [
            {
              userId: "user-2",
              organizationId: "org-1",
              role: "MEMBER",
              createdAt: now,
              updatedAt: now,
              user: {
                email: "owner@example.com",
                fullName: "Owner Name"
              }
            }
          ]
        }
      } as unknown as PrismaTransaction;
      return callback(tx);
    });

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/users?userId=user-2&tenantId=tenant-1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      users: [{ id: "user-2", email: "owner@example.com", fullName: "Owner Name" }]
    });

    await server.close();
  });

  it("lists all task users when no ids are supplied", async () => {
    const server = await buildServer();
    const now = new Date();

    dbMocks.listEntitlementsForUser.mockResolvedValue([
      {
        id: "ent-1",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-1",
        roles: ["ADMIN"],
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        product: {
          id: "prod-1",
          slug: "tasks",
          name: "Tasks",
          description: null,
          iconUrl: null,
          launcherUrl: null,
          redirectUris: [],
          postLogoutRedirectUris: []
        }
      }
    ]);

    dbMocks.listEntitlementsForOrganization.mockResolvedValue([
      {
        id: "ent-2",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-2",
        roles: ["MEMBER"],
        createdAt: now,
        updatedAt: now,
        expiresAt: null
      },
      {
        id: "ent-3",
        organizationId: "org-1",
        tenantId: "tenant-1",
        productId: "prod-1",
        userId: "user-3",
        roles: ["MEMBER"],
        createdAt: now,
        updatedAt: now,
        expiresAt: null
      }
    ]);

    dbMocks.withAuthorizationTransaction.mockImplementationOnce(async (_claims, callback) => {
      const tx = {
        organizationMember: {
          findMany: async ({ where }: { where: { userId: { in: string[] } } }) =>
            where.userId.in.map((userId) => ({
              userId,
              organizationId: "org-1",
              role: "MEMBER",
              createdAt: now,
              updatedAt: now,
              user: {
                email: `${userId}@example.com`,
                fullName: userId === "user-2" ? "User Two" : null
              }
            }))
        }
      } as unknown as PrismaTransaction;
      return callback(tx);
    });

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/users"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.users).toHaveLength(2);
    expect(payload.users).toEqual(
      expect.arrayContaining([
        { id: "user-2", email: "user-2@example.com", fullName: "User Two" },
        { id: "user-3", email: "user-3@example.com", fullName: null }
      ])
    );

    await server.close();
  });
});
