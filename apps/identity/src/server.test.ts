import { afterAll, describe, expect, it, vi } from "vitest";
import { buildServer } from "./server";
import type { PrismaTransaction } from "@ma/db";

vi.mock("@ma/db", () => ({
  createOrganizationWithOwner: vi.fn(),
  listOrganizationMembers: vi.fn(),
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  getOrganizationMember: vi.fn(),
  createOrganizationInvitation: vi.fn(),
  grantEntitlement: vi.fn(),
  recordAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
  getProductByClientId: vi.fn(),
  listEntitlementsForUser: vi.fn(),
  issueRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokensForSession: vi.fn(),
  withAuthorizationTransaction: vi.fn(async (_claims, callback: (tx: PrismaTransaction) => Promise<unknown>) =>
    callback({} as PrismaTransaction)
  )
}));

vi.mock("@ma/tasks-db", () => ({
  deleteTasksForTenant: vi.fn()
}));

vi.mock("./lib/queues", () => {
  const close = vi.fn();
  return {
    createIdentityQueues: () => ({
      identityEvents: { name: "identity-events" },
      userManagement: { name: "user-management" },
      emitIdentityEvent: vi.fn(),
      emitUserManagementJob: vi.fn(),
      close
    })
  };
});

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.APP_VERSION = process.env.APP_VERSION ?? "0.0.1-test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/postgres";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.IDENTITY_JWT_SECRET =
  process.env.IDENTITY_JWT_SECRET ?? "test-secret-test-secret-test-secret-123";
process.env.IDENTITY_COOKIE_DOMAIN = process.env.IDENTITY_COOKIE_DOMAIN ?? "localhost";

describe("API server", () => {
  const server = buildServer();

  afterAll(async () => {
    await server.close();
  });

  it("returns health status", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("returns version", async () => {
    const response = await server.inject({ method: "GET", url: "/version" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.version).toBe(process.env.APP_VERSION);
  });
});
