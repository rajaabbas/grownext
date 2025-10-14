import Fastify from "fastify";
import { describe, expect, it, beforeEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getOrganizationById: vi.fn(),
  listEntitlementsForUser: vi.fn(),
  listRefreshTokensForUser: vi.fn(),
  listTenantSummariesForOrganization: vi.fn(),
  upsertUserProfile: vi.fn(),
  findRefreshTokenById: vi.fn(),
  revokeRefreshTokenById: vi.fn(),
  recordAuditEvent: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

import portalRoutes from "./index";
import type { TokenService } from "../../lib/token-service";

describe("portal routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns launcher data for authenticated user", async () => {
    const fastify = Fastify();

    fastify.decorate("tokenService", { rotateSession: vi.fn() } as unknown as TokenService);
    fastify.decorateRequest("supabaseClaims", null);

    fastify.addHook("preHandler", async (request) => {
      request.supabaseClaims = {
        sub: "user-1",
        email: "user@example.com",
        organization_id: "org-1",
        user_metadata: { full_name: "User One" }
      } as any;
    });

    await fastify.register(portalRoutes);

    const now = new Date();
    dbMocks.recordAuditEvent.mockResolvedValue({});

    dbMocks.upsertUserProfile.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      fullName: "User One"
    });

    dbMocks.getOrganizationById.mockResolvedValue({ id: "org-1", name: "Org", slug: "org", createdAt: now, updatedAt: now });
    dbMocks.listTenantSummariesForOrganization.mockResolvedValue([
      {
        id: "tenant-1",
        organizationId: "org-1",
        name: "Tenant",
        slug: "tenant",
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
          description: "Task app",
          iconUrl: null,
          launcherUrl: "http://tasks.localhost",
          redirectUris: ["http://tasks.localhost/callback"],
          postLogoutRedirectUris: []
        }
      }
    ]);

    dbMocks.listRefreshTokensForUser.mockResolvedValue([
      {
        id: "token-1",
        tokenHash: "hash",
        userId: "user-1",
        clientId: "client-1",
        productId: "prod-1",
        tenantId: "tenant-1",
        scope: "tasks:read",
        sessionId: "session-1",
        description: null,
        userAgent: "jest",
        ipAddress: "127.0.0.1",
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: null,
        createdAt: now,
        updatedAt: now
      }
    ]);

    const response = await fastify.inject({ method: "GET", url: "/launcher" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.user.email).toBe("user@example.com");
    expect(payload.products[0]?.launchUrl).toBe("http://tasks.localhost");
    expect(payload.sessions).toHaveLength(1);

    await fastify.close();
  });

  it("revokes a session and rotates tokens", async () => {
    const fastify = Fastify();
    const rotateSession = vi.fn();

    fastify.decorate("tokenService", { rotateSession } as unknown as TokenService);
    fastify.decorateRequest("supabaseClaims", null);

    fastify.addHook("preHandler", async (request) => {
      request.supabaseClaims = {
        sub: "user-1",
        email: "user@example.com",
        organization_id: "org-1"
      } as any;
    });

    await fastify.register(portalRoutes);

    const now = new Date();
    dbMocks.findRefreshTokenById.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      productId: "prod-1",
      tenantId: "tenant-1",
      sessionId: "session-1",
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
      tokenHash: "hash",
      clientId: "client-1",
      scope: null,
      description: null,
      userAgent: null,
      ipAddress: null,
      expiresAt: now
    });

    const response = await fastify.inject({ method: "DELETE", url: "/sessions/token-1" });
    expect(response.statusCode).toBe(204);
    expect(dbMocks.revokeRefreshTokenById).toHaveBeenCalledWith(expect.anything(), "token-1");
    expect(rotateSession).toHaveBeenCalledWith("session-1");

    await fastify.close();
  });
});
