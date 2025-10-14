import { randomBytes, createSecretKey } from "node:crypto";
import { SignJWT, jwtVerify, exportJWK, type JWTPayload } from "jose";
import { env, buildServiceRoleClaims } from "@ma/core";
import type { ProductRole } from "@ma/db";
import {
  findRefreshTokenByHash,
  issueRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokensForSession
} from "@ma/db";

const textEncoder = new TextEncoder();

export interface AccessTokenContext {
  userId: string;
  clientId: string;
  productId: string;
  tenantId: string;
  organizationId: string;
  roles: ProductRole[];
  scope: string;
  sessionId?: string | null;
  email?: string | null;
  nonce?: string | null;
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  aud: string | string[];
  tenant_id: string;
  organization_id: string;
  product_id: string;
  roles: ProductRole[];
  scope: string;
  session_id?: string;
  email?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

const ACCESS_TOKEN_TYP = "at+jwt";
const ID_TOKEN_TYP = "JWT";

interface RefreshTokenMetadata {
  description?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

interface IssueTokenSetOptions {
  existingRefreshToken?: string;
  metadata?: RefreshTokenMetadata;
}

export class TokenService {
  private readonly secretKey = createSecretKey(textEncoder.encode(env.IDENTITY_JWT_SECRET));
  private readonly accessTokenTtl = env.IDENTITY_ACCESS_TOKEN_TTL_SECONDS;
  private readonly refreshTokenTtl = env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS;
  private readonly issuer = env.IDENTITY_ISSUER;
  private readonly kid = env.IDENTITY_JWT_KID;

  async issueTokenSet(
    context: AccessTokenContext,
    options?: IssueTokenSetOptions
  ): Promise<TokenSet> {
    const accessPayload: AccessTokenPayload = {
      sub: context.userId,
      aud: context.clientId,
      tenant_id: context.tenantId,
      organization_id: context.organizationId,
      product_id: context.productId,
      roles: context.roles,
      scope: context.scope,
      session_id: context.sessionId ?? undefined,
      email: context.email ?? undefined
    };

    const accessToken = await this.createAccessToken(accessPayload);
    const idToken = await this.createIdToken(accessPayload, context.nonce);
    const refreshToken = await this.createOrRotateRefreshToken(context, options);

    return {
      accessToken,
      refreshToken,
      idToken,
      expiresIn: this.accessTokenTtl,
      tokenType: "Bearer"
    };
  }

  async createAccessToken(payload: AccessTokenPayload): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", kid: this.kid, typ: ACCESS_TOKEN_TYP })
      .setIssuer(this.issuer)
      .setAudience(payload.aud)
      .setSubject(payload.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTokenTtl)
      .sign(this.secretKey);
  }

  async createIdToken(payload: AccessTokenPayload, nonce: string | null = null): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const idPayload: JWTPayload = {
      sub: payload.sub,
      aud: payload.aud,
      email: payload.email,
      org_id: payload.organization_id,
      tenant_id: payload.tenant_id,
      product_id: payload.product_id,
      roles: payload.roles,
      iat: now,
      exp: now + this.accessTokenTtl,
      iss: this.issuer,
      ...(nonce ? { nonce } : {})
    };

    return await new SignJWT(idPayload)
      .setProtectedHeader({ alg: "HS256", kid: this.kid, typ: ID_TOKEN_TYP })
      .sign(this.secretKey);
  }

  async verifyAccessToken(token: string, expectedAudience?: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey, {
      issuer: this.issuer,
      audience: expectedAudience
    });

    return payload as AccessTokenPayload;
  }

  async validateRefreshToken(token: string, clientId: string) {
    const record = await findRefreshTokenByHash(buildServiceRoleClaims(undefined), token);
    if (!record) {
      return null;
    }

    if (record.clientId !== clientId) {
      return null;
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await revokeRefreshToken(buildServiceRoleClaims(undefined), token);
      return null;
    }

    return record;
  }

  async rotateSession(sessionId: string) {
    await revokeRefreshTokensForSession(buildServiceRoleClaims(undefined), sessionId);
  }

  async getJwks() {
    const jwk = await exportJWK(this.secretKey);
    return {
      keys: [
        {
          ...jwk,
          use: "sig",
          kty: jwk.kty,
          kid: this.kid,
          alg: "HS256"
        }
      ]
    };
  }

  private async createOrRotateRefreshToken(
    context: AccessTokenContext,
    options?: IssueTokenSetOptions
  ): Promise<string> {
    const existingToken = options?.existingRefreshToken;
    const metadata = options?.metadata ?? {};

    if (existingToken) {
      await revokeRefreshToken(buildServiceRoleClaims(undefined), existingToken).catch(() => undefined);
    }

    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + this.refreshTokenTtl * 1000);

    await issueRefreshToken(buildServiceRoleClaims(undefined), {
      userId: context.userId,
      clientId: context.clientId,
      productId: context.productId,
      tenantId: context.tenantId,
      sessionId: context.sessionId ?? null,
      token: refreshToken,
      scope: context.scope,
      expiresAt,
      description: metadata.description ?? null,
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null
    });

    return refreshToken;
  }
}
