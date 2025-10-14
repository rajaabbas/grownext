import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductRole } from "@ma/db";

const dbMocks = vi.hoisted(() => ({
  issueRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokensForSession: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

import { TokenService } from "./token-service";

const context = {
  userId: "user-1",
  clientId: "client-1",
  productId: "tasks",
  tenantId: "tenant-1",
  organizationId: "org-1",
  scope: "tasks:read",
  roles: ["ADMIN" as ProductRole],
  sessionId: "session-1"
};

describe("TokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues and verifies access tokens", async () => {
    const service = new TokenService();
    dbMocks.issueRefreshToken.mockResolvedValue({});

    const tokens = await service.issueTokenSet(context);

    expect(dbMocks.issueRefreshToken).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: context.userId,
      tenantId: context.tenantId,
      scope: context.scope
    }));

    const payload = await service.verifyAccessToken(tokens.accessToken, context.clientId);
    expect(payload.tenant_id).toBe(context.tenantId);
    expect(payload.scope).toBe(context.scope);
  });

  it("validates refresh tokens", async () => {
    const service = new TokenService();
    dbMocks.findRefreshTokenByHash.mockResolvedValue({
      clientId: context.clientId,
      expiresAt: new Date(Date.now() + 10_000),
      userId: context.userId
    });

    const result = await service.validateRefreshToken("token", context.clientId);
    expect(result).not.toBeNull();
  });
});
