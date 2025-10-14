import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { TokenValidationResult, TokenValidatorOptions, IdentityTokenPayload, Entitlement } from "./types";

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return String(value)
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const buildEntitlements = (payload: IdentityTokenPayload): Entitlement[] => {
  if (Array.isArray(payload.entitlements) && payload.entitlements.length > 0) {
    return payload.entitlements.map((entry) => ({
      productId: String(entry.product_id ?? payload.product_id),
      tenantId: String(entry.tenant_id ?? payload.tenant_id),
      organizationId: entry.organization_id ?? payload.organization_id,
      roles: toStringArray(entry.roles ?? payload.roles)
    }));
  }

  return [
    {
      productId: String(payload.product_id),
      tenantId: String(payload.tenant_id),
      organizationId: payload.organization_id,
      roles: toStringArray(payload.roles)
    }
  ];
};

type RemoteJwkFetcher = ReturnType<typeof createRemoteJWKSet>;

export class IdentityTokenValidator {
  readonly options: TokenValidatorOptions;
  private readonly jwks: RemoteJwkFetcher;

  constructor(options: TokenValidatorOptions, jwks?: RemoteJwkFetcher) {
    this.options = options;
    this.jwks =
      jwks ??
      createRemoteJWKSet(new URL(options.jwksUrl), {
        cacheMaxAge: options.cacheTtlMs ?? 60_000
      });
  }

  async validateBearerToken(token: string): Promise<TokenValidationResult> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.options.expectedIssuer,
      audience: this.options.expectedAudience,
      clockTolerance: this.options.clockToleranceSeconds ?? 5
    });

    const identityPayload = payload as IdentityTokenPayload & JWTPayload;

    const entitlements = buildEntitlements(identityPayload);

    if (!identityPayload.sub) {
      throw new Error("Token is missing subject claim");
    }

    return {
      subject: identityPayload.sub,
      payload: identityPayload,
      entitlements,
      issuedAt: new Date((identityPayload.iat ?? Date.now() / 1000) * 1000),
      expiresAt: new Date((identityPayload.exp ?? Date.now() / 1000) * 1000)
    };
  }
}
