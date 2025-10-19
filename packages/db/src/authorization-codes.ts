import { createHash } from "node:crypto";
import type { AuthorizationCode, ProductRole } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

interface CreateAuthorizationCodeInput {
  code: string;
  userId: string;
  clientId: string;
  productId: string;
  tenantId: string;
  organizationId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  sessionId?: string | null;
  nonce?: string | null;
  roles: ProductRole[];
  email?: string | null;
  expiresAt: Date;
}

const hashCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

export const createAuthorizationCodeRecord = async (
  claims: SupabaseJwtClaims | null,
  input: CreateAuthorizationCodeInput
): Promise<AuthorizationCode> => {
  const codeHash = hashCode(input.code);
  return withAuthorizationTransaction(claims, (tx) =>
    tx.authorizationCode.create({
      data: {
        codeHash,
        userId: input.userId,
        clientId: input.clientId,
        productId: input.productId,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        sessionId: input.sessionId ?? null,
        nonce: input.nonce ?? null,
        roles: input.roles,
        email: input.email ?? null,
        expiresAt: input.expiresAt
      }
    })
  );
};

export const consumeAuthorizationCodeRecord = async (
  claims: SupabaseJwtClaims | null,
  code: string
): Promise<AuthorizationCode | null> => {
  const codeHash = hashCode(code);
  return withAuthorizationTransaction(claims, async (tx) => {
    const record = await tx.authorizationCode.findUnique({
      where: { codeHash }
    });

    if (!record) {
      return null;
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await tx.authorizationCode.delete({
        where: { id: record.id }
      });
      return null;
    }

    await tx.authorizationCode.delete({
      where: { id: record.id }
    });

    return record;
  });
};

export const pruneExpiredAuthorizationCodes = async (
  claims: SupabaseJwtClaims | null,
  now: Date = new Date()
): Promise<number> => {
  const result = await withAuthorizationTransaction(claims, (tx) =>
    tx.authorizationCode.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    })
  );

  return result.count;
};
