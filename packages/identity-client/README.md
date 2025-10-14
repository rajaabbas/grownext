# Identity Client

Shared token validation helpers consumed by every application in the platform.

## Responsibilities

- Fetch and cache JWKS keys exposed by the identity service
- Validate OIDC access tokens and translate claims into entitlements
- Provide lightweight middleware adapters for web frameworks (Fastify, Next.js API routes, edge runtimes)

## Usage

```ts
import { IdentityTokenValidator } from "@ma/identity-client";

const validator = new IdentityTokenValidator({
  jwksUrl: process.env.IDENTITY_JWKS_URL!,
  expectedAudience: "tasks",
  expectedIssuer: "https://identity.localhost"
});

const identity = await validator.validateBearerToken(req.headers.authorization?.split(" ")[1] ?? "");
```
