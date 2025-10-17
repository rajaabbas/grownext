import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaTransaction } from "./prisma";

const mockTx: Record<string, unknown> = {};

vi.mock("./prisma", async (original) => {
  const actual = await original<typeof import("./prisma")>();
  return {
    ...actual,
    withAuthorizationTransaction: vi.fn(async (_claims, callback) => callback(mockTx as PrismaTransaction))
  };
});

import { issueRefreshToken } from "./refresh-tokens";

describe("issueRefreshToken", () => {
  beforeEach(() => {
    mockTx.refreshToken = {
      create: vi.fn().mockImplementation(async ({ data }) => data)
    };
  });

  it("stores a hashed representation of the token", async () => {
    const token = "refresh-token-value";
    const result = await issueRefreshToken(null, {
      userId: "user-1",
      clientId: "client",
      token,
      expiresAt: new Date()
    });

    expect(result.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
  });
});
