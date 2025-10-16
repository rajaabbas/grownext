import {
  randomBytes,
  createSecretKey,
  createPrivateKey,
  createPublicKey,
  type KeyObject
} from "node:crypto";
import { SignJWT, jwtVerify, exportJWK, type JWTPayload } from "jose";
import { env, buildServiceRoleClaims } from "@ma/core";
import type { ProductRole } from "@ma/db";
import {
  findRefreshTokenByHash,
  issueRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokensForSession
} from "@ma/db";

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

const normalizePem = (value?: string | null) => {
  if (!value) return undefined;
  let trimmed = value.trim().replace(/\r\n/g, "\n");
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  trimmed = trimmed.trim();
  trimmed = trimmed.replace(/\r\n/g, "\n");
  if (!trimmed.includes("\n") && trimmed.includes("\\n")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed;
};

interface TokenServiceOptions {
  privateKeyPem?: string;
  publicKeyPem?: string;
  secret?: string;
  algorithm?: "HS256" | "RS256";
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  issuer?: string;
  kid?: string;
}

type SigningConfig =
  | {
      alg: "HS256";
      signingKey: KeyObject;
      verificationKey: KeyObject;
      jwksAvailable: false;
    }
  | {
      alg: "RS256";
      signingKey: KeyObject;
      verificationKey: KeyObject;
      jwksAvailable: true;
    };

export class TokenService {
  private readonly signing: SigningConfig;
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly issuer: string;
  private readonly kid: string;

  constructor(options?: TokenServiceOptions) {
    this.accessTokenTtl = options?.accessTokenTtlSeconds ?? env.IDENTITY_ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTokenTtl =
      options?.refreshTokenTtlSeconds ?? env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS;
    this.issuer = options?.issuer ?? env.IDENTITY_ISSUER;
    this.kid = options?.kid ?? env.IDENTITY_JWT_KID;

    const algorithm = options?.algorithm ?? env.IDENTITY_JWT_ALG;
    const privateKeyPemRaw =
      options?.privateKeyPem ??
      (algorithm === "RS256" ? env.IDENTITY_JWT_PRIVATE_KEY : undefined);
    const publicKeyPemRaw =
      options?.publicKeyPem ??
      (algorithm === "RS256" ? env.IDENTITY_JWT_PUBLIC_KEY : undefined);
    const privateKeyPem = normalizePem(privateKeyPemRaw);
    if (privateKeyPem) {
      const privateKey = createPrivateKey({ key: privateKeyPem, format: "pem", type: "pkcs8" });
      const normalizedPublicKey = normalizePem(publicKeyPemRaw);
      const publicKey =
        normalizedPublicKey != null
          ? createPublicKey({
              key: normalizedPublicKey,
              format: "pem",
              type: "spki"
            })
          : createPublicKey({ key: privateKeyPem, format: "pem", type: "pkcs8" });

      this.signing = {
        alg: "RS256",
        signingKey: privateKey,
        verificationKey: publicKey,
        jwksAvailable: true
      };
      return;
    }

    if (algorithm === "RS256") {
      throw new Error("IDENTITY_JWT_PRIVATE_KEY is required when IDENTITY_JWT_ALG=RS256");
    }

    const secret = options?.secret ?? env.IDENTITY_JWT_SECRET;
    if (!secret) {
      throw new Error("IDENTITY_JWT_SECRET is required when IDENTITY_JWT_ALG=HS256");
    }

    const symmetricKey = createSecretKey(Buffer.from(secret, "utf8"));
    this.signing = {
      alg: "HS256",
      signingKey: symmetricKey,
      verificationKey: symmetricKey,
      jwksAvailable: false
    };
  }

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
      .setProtectedHeader({ alg: this.signing.alg, kid: this.kid, typ: ACCESS_TOKEN_TYP })
      .setIssuer(this.issuer)
      .setAudience(payload.aud)
      .setSubject(payload.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTokenTtl)
      .sign(this.signing.signingKey);
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
      .setProtectedHeader({ alg: this.signing.alg, kid: this.kid, typ: ID_TOKEN_TYP })
      .sign(this.signing.signingKey);
  }

  async verifyAccessToken(token: string, expectedAudience?: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.signing.verificationKey, {
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
    if (!this.signing.jwksAvailable) {
      throw new Error("JWKS is unavailable when using symmetric signing keys (HS256).");
    }

    const jwk = await exportJWK(this.signing.verificationKey);
    return {
      keys: [
        {
          ...jwk,
          use: "sig",
          kty: jwk.kty,
          kid: this.kid,
          alg: this.signing.alg
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
