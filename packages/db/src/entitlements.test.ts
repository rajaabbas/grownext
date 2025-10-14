import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTransaction } from "./prisma";

const mockTx: Record<string, any> = {};

vi.mock("./prisma", async (original) => {
  const actual = await original<typeof import("./prisma")>();
  return {
    ...actual,
    withAuthorizationTransaction: vi.fn(async (_claims, callback) => callback(mockTx as PrismaTransaction))
  };
});

import { grantEntitlement } from "./entitlements";

describe("grantEntitlement", () => {
  beforeEach(() => {
    mockTx.productEntitlement = {
      upsert: vi.fn().mockImplementation(async ({ create, update }) => ({ ...create, ...update }))
    };
  });

  it("upserts entitlements scoped to a tenant", async () => {
    const result = await grantEntitlement(null, {
      organizationId: "org-1",
      tenantId: "tenant-1",
      productId: "product-1",
      userId: "user-1",
      roles: ["ADMIN"]
    });

    expect(result.tenantId).toBe("tenant-1");
    expect(result.roles).toEqual(["ADMIN"]);
  });
});
