import { createSecretKey } from "node:crypto";
import { SignJWT, createRemoteJWKSet } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityTokenValidator } from "./tokens";

const secret = "test-secret-test-secret-test-secret";
const samplePayload = {
  sub: "user-1",
  aud: "tasks",
  iss: "https://identity.localhost",
  tenant_id: "tenant-1",
  organization_id: "org-1",
  product_id: "tasks",
  roles: ["ADMIN"],
  scope: "tasks:read",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600
};

describe("IdentityTokenValidator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates and parses entitlements", async () => {
    const token = await new SignJWT(samplePayload)
      .setProtectedHeader({ alg: "HS256", kid: "test-key" })
      .sign(Buffer.from(secret));

    const jwksFetcher: ReturnType<typeof createRemoteJWKSet> = Object.assign(
      async (_protectedHeader?: unknown, _token?: unknown) => {
        void _protectedHeader;
        void _token;
        return createSecretKey(Buffer.from(secret));
      },
      {
        coolingDown: false,
        fresh: true,
        reloading: false,
        reload: async () => {
          /* no-op */
        },
        jwks: () => undefined
      }
    );

    const validator = new IdentityTokenValidator(
      {
        expectedAudience: "tasks",
        expectedIssuer: "https://identity.localhost",
        jwksUrl: "https://identity.localhost/.well-known/jwks.json",
        cacheTtlMs: 10_000
      },
      jwksFetcher
    );

    const result = await validator.validateBearerToken(token);

    expect(result.subject).toBe(samplePayload.sub);
    expect(result.entitlements[0].roles).toContain("ADMIN");
    expect(result.entitlements[0].productId).toBe("tasks");
  });
});
