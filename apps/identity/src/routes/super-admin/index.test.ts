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
  recordAuditEvent: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

import superAdminRoutes from "./index";

const buildServer = async (claims: SupabaseJwtClaims | null) => {
  const server = Fastify();
  server.decorateRequest("supabaseClaims", null);
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
});
