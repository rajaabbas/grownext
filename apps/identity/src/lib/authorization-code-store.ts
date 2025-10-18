import { randomBytes } from "node:crypto";
import { buildServiceRoleClaims, env, logger } from "@ma/core";
import {
  createAuthorizationCodeRecord,
  consumeAuthorizationCodeRecord,
  pruneExpiredAuthorizationCodes,
  type ProductRole
} from "@ma/db";

export interface AuthorizationCodePayload {
  userId: string;
  clientId: string;
  productId: string;
  tenantId: string;
  organizationId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  sessionId?: string | null;
  nonce?: string | null;
  roles: ProductRole[];
  email?: string | null;
}

export interface AuthorizationCodeEntry extends AuthorizationCodePayload {
  code: string;
  createdAt: number;
  expiresAt: number;
}

const generateCode = () => randomBytes(32).toString("base64url");

export class AuthorizationCodeStore {
  private readonly ttlMs: number;
  private readonly claims = buildServiceRoleClaims(undefined);

  constructor(ttlSeconds = env.IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS) {
    this.ttlMs = ttlSeconds * 1000;
    setInterval(() => {
      void this.pruneExpiredCodes();
    }, this.ttlMs).unref();
  }

  async create(payload: AuthorizationCodePayload): Promise<AuthorizationCodeEntry> {
    const code = generateCode();
    const now = Date.now();
    const expiresAt = new Date(now + this.ttlMs);

    await createAuthorizationCodeRecord(this.claims, {
      code,
      userId: payload.userId,
      clientId: payload.clientId,
      productId: payload.productId,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      redirectUri: payload.redirectUri,
      scope: payload.scope,
      codeChallenge: payload.codeChallenge,
      codeChallengeMethod: payload.codeChallengeMethod,
      sessionId: payload.sessionId ?? null,
      nonce: payload.nonce ?? null,
      roles: payload.roles,
      email: payload.email ?? null,
      expiresAt
    });

    return {
      ...payload,
      code,
      createdAt: now,
      expiresAt: expiresAt.getTime()
    };
  }

  async consume(code: string): Promise<AuthorizationCodeEntry | null> {
    const record = await consumeAuthorizationCodeRecord(this.claims, code);

    if (!record) {
      return null;
    }

    return {
      code,
      userId: record.userId,
      clientId: record.clientId,
      productId: record.productId,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      redirectUri: record.redirectUri,
      scope: record.scope,
      codeChallenge: record.codeChallenge,
      codeChallengeMethod: record.codeChallengeMethod as AuthorizationCodePayload["codeChallengeMethod"],
      sessionId: record.sessionId,
      nonce: record.nonce,
      roles: record.roles,
      email: record.email,
      createdAt: record.createdAt.getTime(),
      expiresAt: record.expiresAt.getTime()
    };
  }

  private async pruneExpiredCodes(): Promise<void> {
    try {
      await pruneExpiredAuthorizationCodes(this.claims);
    } catch (error) {
      logger.error({ error }, "Failed to prune expired authorization codes");
    }
  }
}
