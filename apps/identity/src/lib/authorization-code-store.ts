import { randomBytes } from "node:crypto";
import { env } from "@ma/core";
import type { ProductRole } from "@ma/db";

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

interface AuthorizationCodeEntry extends AuthorizationCodePayload {
  code: string;
  createdAt: number;
  expiresAt: number;
}

const generateCode = () => randomBytes(32).toString("base64url");

export class AuthorizationCodeStore {
  private readonly codes = new Map<string, AuthorizationCodeEntry>();
  private readonly ttlMs: number;

  constructor(ttlSeconds = env.IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS) {
    this.ttlMs = ttlSeconds * 1000;
    setInterval(() => this.prune(), this.ttlMs).unref();
  }

  create(payload: AuthorizationCodePayload): AuthorizationCodeEntry {
    const code = generateCode();
    const now = Date.now();
    const entry: AuthorizationCodeEntry = {
      ...payload,
      code,
      createdAt: now,
      expiresAt: now + this.ttlMs
    };

    this.codes.set(code, entry);
    return entry;
  }

  consume(code: string): AuthorizationCodeEntry | null {
    const entry = this.codes.get(code);
    if (!entry) {
      return null;
    }

    this.codes.delete(code);
    if (entry.expiresAt < Date.now()) {
      return null;
    }

    return entry;
  }

  private prune() {
    const now = Date.now();
    for (const [code, entry] of this.codes.entries()) {
      if (entry.expiresAt < now) {
        this.codes.delete(code);
      }
    }
  }
}
