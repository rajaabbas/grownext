import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseJwtClaims } from "@ma/core";

const dbMocks = vi.hoisted(() => ({
  createOrganizationWithOwner: vi.fn(),
  listOrganizationMembers: vi.fn(),
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  createOrganizationInvitation: vi.fn(),
  updateOrganization: vi.fn(),
  listOrganizationInvitations: vi.fn(),
  getOrganizationMember: vi.fn(),
  grantEntitlement: vi.fn(),
  getTenantById: vi.fn(),
  getTenantBySlug: vi.fn(),
  listTenantMembers: vi.fn(),
  listTenantApplications: vi.fn(),
  attachMemberToTenant: vi.fn(),
  removeTenantMember: vi.fn(),
  updateTenant: vi.fn(),
  deleteTenant: vi.fn(),
  removeOrganizationMember: vi.fn(),
  deleteOrganization: vi.fn(),
  listProducts: vi.fn(),
  listEntitlementsForOrganization: vi.fn(),
  listEntitlementsForTenant: vi.fn(),
  getEntitlementById: vi.fn(),
  revokeEntitlement: vi.fn(),
  linkProductToTenant: vi.fn(),
  unlinkProductFromTenant: vi.fn(),
  recordAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
  withAuthorizationTransaction: vi.fn(async (_claims, callback) => callback({} as never)),
  createSamlConnection: vi.fn(),
  updateSamlConnection: vi.fn(),
  deleteSamlConnection: vi.fn(),
  listSamlConnectionsForOrganization: vi.fn(),
  getSamlConnectionById: vi.fn(),
  supabaseServiceClient: {
    auth: {
      admin: {
        updateUserById: vi.fn(),
        getUserById: vi.fn()
      }
    }
  },
  listRecentBulkJobsImpactingUser: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);
vi.mock("@ma/tasks-db", () => ({ deleteTasksForTenant: vi.fn() }));

import adminRoutes from "./index";

describe("admin routes organization scope guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildServer = async (claims: SupabaseJwtClaims) => {
    const fastify = Fastify();
    fastify.decorate("queues", {
      emitIdentityEvent: vi.fn(),
      emitUserManagementJob: vi.fn()
    });
    fastify.decorate("samlService", null);
    fastify.decorateRequest("supabaseClaims", null);
    fastify.addHook("preHandler", async (request) => {
      request.supabaseClaims = claims;
    });

    await fastify.register(adminRoutes);
    return fastify;
  };

  it("rejects organization-scoped requests when claims do not match", async () => {
    const server = await buildServer({
      sub: "user-1",
      email: "owner@example.com",
      organization_id: "org-1"
    } as SupabaseJwtClaims);

    dbMocks.getOrganizationMember.mockResolvedValue({ role: "OWNER" });
    dbMocks.listTenants.mockResolvedValue([]);
    dbMocks.listOrganizationMembers.mockResolvedValue([]);
    dbMocks.listOrganizationInvitations.mockResolvedValue([]);

    const response = await server.inject({ method: "GET", url: "/organizations/org-2" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "organization_scope_mismatch" });
    expect(dbMocks.getOrganizationMember).not.toHaveBeenCalled();

    await server.close();
  });

  it("allows access when claims match organization", async () => {
    const server = await buildServer({
      sub: "user-1",
      email: "owner@example.com",
      organization_id: "org-1"
    } as SupabaseJwtClaims);

    dbMocks.getOrganizationMember.mockResolvedValue({ id: "member-1", role: "OWNER" });
    dbMocks.listTenants.mockResolvedValue([]);
    dbMocks.listOrganizationMembers.mockResolvedValue([]);
    dbMocks.listOrganizationInvitations.mockResolvedValue([]);

    const response = await server.inject({ method: "GET", url: "/organizations/org-1" });
    expect(response.statusCode).toBe(200);
    expect(dbMocks.getOrganizationMember).toHaveBeenCalled();

    await server.close();
  });
});
