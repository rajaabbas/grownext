import { randomUUID, createHash } from "node:crypto";
import type { RefreshToken } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

interface IssueRefreshTokenInput {
  userId: string;
  clientId: string;
  productId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
  token: string;
  description?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  scope?: string | null;
}

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const issueRefreshToken = async (
  claims: SupabaseJwtClaims | null,
  input: IssueRefreshTokenInput
): Promise<RefreshToken> => {
  const tokenHash = hashToken(input.token);
  return withAuthorizationTransaction(claims, (tx) =>
    tx.refreshToken.create({
      data: {
        id: randomUUID(),
        tokenHash,
        userId: input.userId,
        clientId: input.clientId,
        productId: input.productId ?? null,
        tenantId: input.tenantId ?? null,
        scope: input.scope ?? null,
        sessionId: input.sessionId ?? null,
        description: input.description ?? null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        expiresAt: input.expiresAt
      }
    })
  );
};

export const revokeRefreshToken = async (
  claims: SupabaseJwtClaims | null,
  token: string
): Promise<void> => {
  const tokenHash = hashToken(token);
  await withAuthorizationTransaction(claims, (tx) =>
    tx.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })
  );
};

export const revokeRefreshTokensForSession = async (
  claims: SupabaseJwtClaims | null,
  sessionId: string
): Promise<number> => {
  const result = await withAuthorizationTransaction(claims, (tx) =>
    tx.refreshToken.updateMany({
      where: {
        sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })
  );

  return result.count;
};

export const listRefreshTokensForUser = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<RefreshToken[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const findRefreshTokenByHash = async (
  claims: SupabaseJwtClaims | null,
  token: string
): Promise<RefreshToken | null> => {
  const tokenHash = hashToken(token);
  return withAuthorizationTransaction(claims, (tx) =>
    tx.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null
      }
    })
  );
};
