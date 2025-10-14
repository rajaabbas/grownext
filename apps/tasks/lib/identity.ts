import { IdentityTokenValidator, verifyAuthorizationHeader } from "@ma/identity-client";

const validator = new IdentityTokenValidator({
  expectedAudience: process.env.TASKS_CLIENT_ID ?? "tasks",
  expectedIssuer: process.env.IDENTITY_ISSUER ?? "http://localhost:3100",
  jwksUrl: process.env.IDENTITY_JWKS_URL ?? "http://localhost:3100/.well-known/jwks.json",
  cacheTtlMs: 60_000
});

export const validateIdentity = (headers: Headers) => verifyAuthorizationHeader(headers, validator);
