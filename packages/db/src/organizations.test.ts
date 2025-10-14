import { describe, expect, it, beforeEach, vi } from "vitest";
import type { PrismaTransaction } from "./prisma";

const mockTx: Record<string, any> = {};

vi.mock("./prisma", async (original) => {
  const actual = await original<typeof import("./prisma")>();
  return {
    ...actual,
    withAuthorizationTransaction: vi.fn(async (_claims, callback) => callback(mockTx as PrismaTransaction))
  };
});

vi.mock("@ma/core", async (original) => {
  const actual = await original<typeof import("@ma/core")>();
  return {
    ...actual,
    buildServiceRoleClaims: vi.fn(() => ({ role: "service", sub: "service-role" }))
  };
});

import { createOrganizationWithOwner } from "./organizations";

const makeResolvedValue = <T>(value: T) => vi.fn().mockResolvedValue(value);

describe("createOrganizationWithOwner", () => {
  beforeEach(() => {
    mockTx.organization = {
      create: makeResolvedValue({ id: "org-1", name: "GrowNext", slug: "grownext" })
    };

    mockTx.userProfile = {
      upsert: makeResolvedValue({ userId: "user-1", email: "owner@example.com", fullName: "Owner" })
    };

    mockTx.organizationMember = {
      create: makeResolvedValue({ id: "member-1", organizationId: "org-1", userId: "user-1", role: "OWNER" })
    };

    mockTx.tenant = {
      create: makeResolvedValue({ id: "tenant-1", organizationId: "org-1", name: "GrowNext Workspace" })
    };

    mockTx.tenantMember = {
      create: makeResolvedValue({ id: "tenant-member-1", tenantId: "tenant-1", organizationMemberId: "member-1", role: "ADMIN" })
    };
  });

  it("creates an organization, default tenant, and membership graph", async () => {
    const result = await createOrganizationWithOwner({
      name: "GrowNext",
      owner: {
        userId: "user-1",
        email: "owner@example.com",
        fullName: "Owner"
      }
    });

    expect(result.organization.slug).toBe("grownext");
    expect(result.defaultTenant.name).toBe("GrowNext Workspace");
    expect(result.ownerMembership.role).toBe("OWNER");
    expect(result.defaultTenantMembership.role).toBe("ADMIN");
  });
});
