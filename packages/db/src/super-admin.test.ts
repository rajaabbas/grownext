import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTransaction } from "./prisma";

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

import { getUserForSuperAdmin, listUsersForSuperAdmin } from "./super-admin";

describe("super admin data access", () => {
  beforeEach(() => {
    mockTx.userProfile = {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    };
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
    const findUniqueMock = (mockTx.userProfile as { findUnique: ReturnType<typeof vi.fn> }).findUnique;

    findUniqueMock.mockResolvedValue({
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

  it("returns null when user cannot be found", async () => {
    const findUniqueMock = (mockTx.userProfile as { findUnique: ReturnType<typeof vi.fn> }).findUnique;
    findUniqueMock.mockResolvedValue(null);

    const result = await getUserForSuperAdmin(null, "missing");
    expect(result).toBeNull();
  });
});
