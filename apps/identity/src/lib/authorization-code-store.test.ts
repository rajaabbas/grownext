import { describe, expect, it } from "vitest";
import { AuthorizationCodeStore } from "./authorization-code-store";

type ProductRole = "ADMIN" | "MEMBER";

const basePayload = {
  userId: "user-1",
  clientId: "client-1",
  productId: "tasks",
  tenantId: "tenant-1",
  organizationId: "org-1",
  redirectUri: "https://app.example.com/callback",
  scope: "tasks:read",
  codeChallenge: "challenge",
  codeChallengeMethod: "S256" as const,
  roles: ["ADMIN" as ProductRole],
  email: "owner@example.com"
};

describe("AuthorizationCodeStore", () => {
  it("creates and consumes codes", () => {
    const store = new AuthorizationCodeStore(1);
    const entry = store.create(basePayload);
    expect(entry.code).toBeDefined();
    const consumed = store.consume(entry.code);
    expect(consumed?.userId).toBe(basePayload.userId);
  });

  it("expires codes after ttl", async () => {
    const store = new AuthorizationCodeStore(0.001);
    const entry = store.create(basePayload);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const consumed = store.consume(entry.code);
    expect(consumed).toBeNull();
  });
});
