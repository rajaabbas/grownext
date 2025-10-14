import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTransaction } from "@ma/db";
import type { SupabaseJwtClaims } from "@ma/core";

const dbMocks = vi.hoisted(() => ({
  getOrganizationById: vi.fn(),
  listEntitlementsForUser: vi.fn(),
  listTenantSummariesForOrganization: vi.fn(),
  withAuthorizationTransaction: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

import internalTasksRoutes from "./tasks";

describe("internal tasks routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      }
    ]);

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/context"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.organization.id).toBe("org-1");
    expect(payload.entitlements).toHaveLength(1);
    expect(payload.activeTenant.tenantId).toBe("tenant-1");
    expect(payload.activeTenant.source).toBe("fallback");

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
        roles: ["EDITOR"],
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
        roles: ["EDITOR"],
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

    const response = await server.inject({
      method: "GET",
      url: "/internal/tasks/context?tenantId=tenant-2"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.activeTenant.tenantId).toBe("tenant-2");
    expect(payload.activeTenant.source).toBe("request");
    expect(payload.activeTenant.roles).toEqual(["EDITOR"]);

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
});
