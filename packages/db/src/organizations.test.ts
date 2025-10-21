import { describe, expect, it, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { PrismaTransaction } from "./prisma";

const mockTx: Record<string, unknown> = {};

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

import {
  createOrganizationWithOwner,
  updateOrganizationMemberRole,
  updateTenantMemberRole
} from "./organizations";

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
      create: makeResolvedValue({ id: "tenant-1", organizationId: "org-1", name: "GrowNext" })
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
    expect(result.defaultTenant.name).toBe("GrowNext");
    expect(result.ownerMembership.role).toBe("OWNER");
    expect(result.defaultTenantMembership.role).toBe("ADMIN");
  });
});

describe("updateOrganizationMemberRole", () => {
  beforeEach(() => {
    mockTx.organizationMember = {
      update: vi.fn().mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role: "ADMIN"
      })
    };
  });

  it("updates the organization member role", async () => {
    const result = await updateOrganizationMemberRole(null, {
      organizationId: "org-1",
      userId: "user-1",
      role: "ADMIN"
    });

    const organizationMember = mockTx.organizationMember as {
      update: ReturnType<typeof vi.fn>;
    };

    expect(organizationMember.update).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-1",
          userId: "user-1"
        }
      },
      data: { role: "ADMIN" }
    });
    expect(result?.role).toBe("ADMIN");
  });

  it("returns null when the membership does not exist", async () => {
    const organizationMember = mockTx.organizationMember as {
      update: ReturnType<typeof vi.fn>;
    };
    organizationMember.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "5.22.0"
      })
    );

    const result = await updateOrganizationMemberRole(null, {
      organizationId: "org-1",
      userId: "missing",
      role: "ADMIN"
    });

    expect(result).toBeNull();
  });
});

describe("updateTenantMemberRole", () => {
  beforeEach(() => {
    mockTx.organizationMember = {
      findUnique: vi.fn().mockResolvedValue({ id: "member-1" })
    };
    mockTx.tenantMember = {
      update: vi.fn().mockResolvedValue({
        tenantId: "tenant-1",
        organizationMemberId: "member-1",
        role: "ADMIN"
      })
    };
  });

  it("updates the tenant membership role when membership exists", async () => {
    const result = await updateTenantMemberRole(null, {
      organizationId: "org-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN"
    });

    expect(
      (mockTx.organizationMember as { findUnique: ReturnType<typeof vi.fn> }).findUnique
    ).toHaveBeenCalled();
    const tenantMember = mockTx.tenantMember as {
      update: ReturnType<typeof vi.fn>;
    };

    expect(tenantMember.update).toHaveBeenCalledWith({
      where: {
        tenantId_organizationMemberId: {
          tenantId: "tenant-1",
          organizationMemberId: "member-1"
        }
      },
      data: { role: "ADMIN" }
    });
    expect(result?.role).toBe("ADMIN");
  });

  it("returns null when organization membership is missing", async () => {
    (mockTx.organizationMember as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(null);

    const result = await updateTenantMemberRole(null, {
      organizationId: "org-1",
      tenantId: "tenant-1",
      userId: "missing",
      role: "ADMIN"
    });

    expect(result).toBeNull();
    expect((mockTx.tenantMember as { update: ReturnType<typeof vi.fn> }).update).not.toHaveBeenCalled();
  });

  it("returns null when tenant membership is missing", async () => {
    const tenantMember = mockTx.tenantMember as {
      update: ReturnType<typeof vi.fn>;
    };

    tenantMember.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "5.22.0"
      })
    );

    const result = await updateTenantMemberRole(null, {
      organizationId: "org-1",
      tenantId: "missing",
      userId: "user-1",
      role: "ADMIN"
    });

    expect(result).toBeNull();
  });
});
