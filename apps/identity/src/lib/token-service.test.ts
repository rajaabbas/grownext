import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import type { ProductRole } from "@ma/db";
import { resetEnvCache } from "@ma/core";

const dbMocks = vi.hoisted(() => ({
  issueRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokensForSession: vi.fn()
}));

vi.mock("@ma/db", () => dbMocks);

const context = {
  userId: "user-1",
  clientId: "client-1",
  productId: "tasks",
  tenantId: "tenant-1",
  organizationId: "org-1",
  scope: "tasks:read",
  roles: ["ADMIN" as ProductRole],
  sessionId: "session-1",
  nonce: "nonce"
};

describe("TokenService", () => {
const createRsaKeyPair = async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const [privateKeyPem, publicKeyPem] = await Promise.all([
    exportPKCS8(privateKey),
    exportSPKI(publicKey)
  ]);
  return { privateKeyPem, publicKeyPem };
};

const ensureBaseEnv = () => {
  process.env.IDENTITY_JWT_KID = process.env.IDENTITY_JWT_KID ?? "test-kid";
  process.env.IDENTITY_ISSUER = process.env.IDENTITY_ISSUER ?? "http://identity.local";
  process.env.IDENTITY_ACCESS_TOKEN_TTL_SECONDS = "300";
  process.env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS = "1200";
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEnvCache();
  ensureBaseEnv();
});

  it("issues and verifies access tokens", async () => {
    const { TokenService } = await import("./token-service");
    const { privateKeyPem, publicKeyPem } = await createRsaKeyPair();
    const service = new TokenService({
      privateKeyPem,
      publicKeyPem,
      algorithm: "RS256",
      accessTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 1200,
      issuer: "http://identity.local",
      kid: "test-kid"
    });
    dbMocks.issueRefreshToken.mockResolvedValue({});

    const tokens = await service.issueTokenSet(context, {
      metadata: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        description: "test token"
      }
    });

    expect(dbMocks.issueRefreshToken).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: context.userId,
      tenantId: context.tenantId,
      scope: context.scope,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      description: "test token"
    }));

    const payload = await service.verifyAccessToken(tokens.accessToken, context.clientId);
    expect(payload.tenant_id).toBe(context.tenantId);
    expect(payload.scope).toBe(context.scope);
  });

  it("validates refresh tokens", async () => {
    const { TokenService } = await import("./token-service");
    const { privateKeyPem, publicKeyPem } = await createRsaKeyPair();
    const service = new TokenService({
      privateKeyPem,
      publicKeyPem,
      algorithm: "RS256",
      accessTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 1200,
      issuer: "http://identity.local",
      kid: "test-kid"
    });
    dbMocks.findRefreshTokenByHash.mockResolvedValue({
      clientId: context.clientId,
      expiresAt: new Date(Date.now() + 10_000),
      userId: context.userId
    });

    const result = await service.validateRefreshToken("token", context.clientId);
    expect(result).not.toBeNull();
  });

  it("exposes JWKS for asymmetric keys", async () => {
    const { TokenService } = await import("./token-service");
    const { privateKeyPem, publicKeyPem } = await createRsaKeyPair();
    const service = new TokenService({
      privateKeyPem,
      publicKeyPem,
      algorithm: "RS256",
      accessTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 1200,
      issuer: "http://identity.local",
      kid: "test-kid"
    });
    const jwks = await service.getJwks();

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]?.kty).toBe("RSA");
    expect(jwks.keys[0]?.alg).toBe("RS256");
  });

  it("rejects JWKS requests for symmetric keys", async () => {
    const { TokenService } = await import("./token-service");
    const service = new TokenService({
      algorithm: "HS256",
      secret: "test-secret-test-secret-test-secret-123",
      accessTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 1200,
      issuer: "http://identity.local",
      kid: "test-kid"
    });
    await expect(service.getJwks()).rejects.toThrow("JWKS is unavailable");
  });
});
