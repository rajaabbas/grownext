import { afterAll, describe, expect, it, vi } from "vitest";
import { buildServer } from "./server";
import type { PrismaTransaction } from "@ma/db";

vi.mock("@ma/db", () => ({
  createOrganizationWithOwner: vi.fn(),
  listOrganizationMembers: vi.fn(),
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  getOrganizationMember: vi.fn(),
  createOrganizationInvitation: vi.fn(),
  grantEntitlement: vi.fn(),
  recordAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
  getProductByClientId: vi.fn(),
  listEntitlementsForUser: vi.fn(),
  issueRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokensForSession: vi.fn(),
  withAuthorizationTransaction: vi.fn(async (_claims, callback: (tx: PrismaTransaction) => Promise<unknown>) =>
    callback({} as PrismaTransaction)
  )
}));

vi.mock("@ma/tasks-db", () => ({
  deleteTasksForTenant: vi.fn()
}));

vi.mock("./lib/queues", () => {
  const close = vi.fn();
  return {
    createIdentityQueues: () => ({
      identityEvents: { name: "identity-events" },
      userManagement: { name: "user-management" },
      emitIdentityEvent: vi.fn(),
      emitUserManagementJob: vi.fn(),
      close
    })
  };
});

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.APP_VERSION = process.env.APP_VERSION ?? "0.0.1-test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/postgres";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.IDENTITY_JWT_ALG = "RS256";
process.env.IDENTITY_JWT_PRIVATE_KEY =
  process.env.IDENTITY_JWT_PRIVATE_KEY ??
  [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDjmWgawYu63e/J",
    "wkPdbacZbgigZzBG+uYFjl7Mi4kM1i+HSSnAh0CHXbiEboJQO+2KiXXyM5/LlEgb",
    "jgwndlnKVWbw3wlg4JbX2dwQK3eyr7T4poZr/A61eIEAwtrmbhpVoQ1SQKDYfMPl",
    "7o542rZixttSmS4wB4mi14ddbdXwMtlfjEnW7v94T5828Fxbmi6l1/Ol5gh4n0tv",
    "p7zm7go8P7sDsVh4nejD62rsJ3tAe6Rq/A5VUZsC+DFp6PMbjTxThjTGUszVaRXM",
    "SttUKH+fn9NFXE6xO9eNG1d4pI0HtV0YzYhWgwvakmNimGG774SkrxFJNnMQY4xT",
    "SQHlsxU3AgMBAAECggEBALEmvFm4C6kQ/mNQIMjn+bI0cdSOekTT2k6VlwVtbOAv",
    "n3WzmB5T5g7nD9V1RibEvYGC5lFrzXG8UTlI6xwJJ4RRY1irc9s/jQzhYQ0Mv4ii",
    "pw+SCf4PXaEnPhtKfj2cXI+K1DWpEqJpWbk1w6HS01l6Y5AwQEfhNf75gdFsWn1I",
    "Kp9+fY4Qf8OCyzD9RG+BKkguX6iLZhcG5Ax+9uj1GXabVOKBnfqd6sO6OuQ6NyJj",
    "9pWd3t1hpsnJXhUPusKpsZ1h9KQ1qPwlVY+2BLOHSDIGZhL1Q2tmYZzY2MqRXOUQ",
    "PtMpz/Wny25YqRtEzvOlp1TQF4QRX1nTZHJAf+JGE3ECgYEA9rWzi3RdOJ/2DjlM",
    "P0s7OOdEjcqsR8Q90v8f6hc4NKA4st8F1jcuS1cc32NnzuccRgDGET2uKmUu/E8O",
    "Rcjfm2wC8bj3lYDbZjO4Xsc3TKO44yGtQimdhsfs9HedFEWc84AdJmoN9TP3wJZk",
    "2nEivOkV1c5kmEMq4o3EAKrmKH0CgYEA7/HcESVz/WHG8t8FlDrJlicT4GQqtgPg",
    "p4+BFWKEdeyFT5oUT7xK/hAW0Hd3v6mSMAf/Sk8EElF9LJY22wF6dKm+ox8wcDvH",
    "Cpq/7xN/t5uPkvPuct1zV1uPim9wZDrcQOLzS0bMzs2x+S0g3UAP19MA9agSxgZj",
    "iDvtzy5n3HkCgYEA75T3ljx8fh+6kcRnkKXR7l0BaUZ4gAjfakhcVatDzRjMpBzt",
    "In3NEzPu7s1iq1Z8QeklmDPDONEBl3aFPbS2/lSB4F8iaVhyzD/SrWvjCx8zygGg",
    "obPnhtjSMxKK0RQjezjXKj0zp3jfKpyzOo2oDTaVSVmMoSm3R9ySyFkQ0WECgYEA",
    "xreDID9jC3YKV6Oi1CFKk/r69ULVPOrG0qEhLd/7P1Q2N+iha3HnON2MsgVi7vjx",
    "8wQlOgBy6Eo2USXftEqv0byQ223+y6OfNPuGgmiZGXLgHdy2NhFMoV9We0aeMkeX",
    "9aqMmACD56Il4BkRKvUXKkP9gdQGQvCCxyYczdf+9XsCgYAgR1j1xR5FIW3DaPzT",
    "2Ifj2I1scESJ84NIO5D2zog1OkWjvwZU+5k3dWe5b1gs0JzKJ4+7XyxS9I7WmYe8",
    "HBKq2o7Tr7krGk9OurkfAbfYEED1RM9ilVL5LXdSmzPg4xT8jo3sJfrkvkASyM4b",
    "XO1QTRis5W84FGTm6TLFpq03Uw==",
    "-----END PRIVATE KEY-----"
  ].join("\n");
process.env.IDENTITY_JWT_PUBLIC_KEY =
  process.env.IDENTITY_JWT_PUBLIC_KEY ??
  [
    "-----BEGIN PUBLIC KEY-----",
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA45loGsGLut3vycJD3W2n",
    "GW4IoGcwRvrmBY5ezIuJDNYvh0kpwIdAh124hG6CUDvtlol18jOfy5RIG44MJ3ZZ",
    "ylVm8N8JYOiW19ncECt3sq+0+KaGa/wOtXiBAMLc5m4aVaENUkCg2HzD5e6OONq2",
    "Ysb7UpkuMAeJoteHXW3V8DLZX4xJ1u7/eE+fNvBcW5oupdfzpeYIeJ9Lb6e85u4K",
    "PD+7A7FYeJ3ow+ta7Cd7QHukavwOVVGbAvgxaejzG408U4Y0xlLM1WkVzErrVCh/",
    "n5/TRVxOsTvXjRtXeKSNB7VdGM2IVoML2pJjYphhu++EpK8RSTZzEGOME0kB5bMV",
    "NwIDAQAB",
    "-----END PUBLIC KEY-----"
  ].join("\n");
process.env.IDENTITY_COOKIE_DOMAIN = process.env.IDENTITY_COOKIE_DOMAIN ?? "localhost";

describe("API server", () => {
  const server = buildServer();

  afterAll(async () => {
    await server.close();
  });

  it("returns health status", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("returns version", async () => {
    const response = await server.inject({ method: "GET", url: "/version" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.version).toBe(process.env.APP_VERSION);
  });
});
