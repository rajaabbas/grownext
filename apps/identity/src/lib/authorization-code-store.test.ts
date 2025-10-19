import type { AuthorizationCode, ProductRole } from "@ma/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@ma/db";
import { AuthorizationCodeStore } from "./authorization-code-store";

const basePayload = {
  userId: "user-1",
  clientId: "client-1",
  productId: "product-1",
  tenantId: "tenant-1",
  organizationId: "org-1",
  redirectUri: "https://app.example.com/callback",
  scope: "tasks:read",
  codeChallenge: "challenge",
  codeChallengeMethod: "S256" as const,
  roles: ["ADMIN" as ProductRole],
  email: "owner@example.com"
};

const createMock = vi.spyOn(db, "createAuthorizationCodeRecord");
const consumeMock = vi.spyOn(db, "consumeAuthorizationCodeRecord");
const pruneMock = vi.spyOn(db, "pruneExpiredAuthorizationCodes");

const buildRecord = (overrides: Partial<AuthorizationCode> = {}): AuthorizationCode => {
  const createdAt = new Date();
  return {
    id: overrides.id ?? "code-db",
    codeHash: overrides.codeHash ?? "hash",
    userId: overrides.userId ?? basePayload.userId,
    clientId: overrides.clientId ?? basePayload.clientId,
    productId: overrides.productId ?? basePayload.productId,
    tenantId: overrides.tenantId ?? basePayload.tenantId,
    organizationId: overrides.organizationId ?? basePayload.organizationId,
    redirectUri: overrides.redirectUri ?? basePayload.redirectUri,
    scope: overrides.scope ?? basePayload.scope,
    codeChallenge: overrides.codeChallenge ?? basePayload.codeChallenge,
    codeChallengeMethod: overrides.codeChallengeMethod ?? basePayload.codeChallengeMethod,
    sessionId: overrides.sessionId ?? null,
    nonce: overrides.nonce ?? null,
    roles: overrides.roles ?? (["ADMIN"] as ProductRole[]),
    email: overrides.email ?? basePayload.email ?? null,
    createdAt: overrides.createdAt ?? createdAt,
    expiresAt:
      overrides.expiresAt ??
      new Date((overrides.createdAt ?? createdAt).getTime() + 1_000)
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue(buildRecord());
  consumeMock.mockResolvedValue(null);
  pruneMock.mockResolvedValue(0);
});

describe("AuthorizationCodeStore", () => {
  it("creates and consumes codes", async () => {
    const store = new AuthorizationCodeStore(1);
    const entry = await store.create(basePayload);
    consumeMock.mockResolvedValueOnce(buildRecord());

    expect(entry.code).toBeDefined();
    const consumed = await store.consume(entry.code);
    expect(consumed?.userId).toBe(basePayload.userId);
    expect(createMock).toHaveBeenCalled();
    expect(consumeMock).toHaveBeenCalledWith(expect.anything(), entry.code);
  });

  it("returns null when the code is missing or expired", async () => {
    const store = new AuthorizationCodeStore(0.001);
    const entry = await store.create(basePayload);
    consumeMock.mockResolvedValueOnce(null);
    const consumed = await store.consume(entry.code);
    expect(consumed).toBeNull();
  });
});
