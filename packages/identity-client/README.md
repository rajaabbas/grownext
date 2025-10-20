# @ma/identity-client

SDK for verifying identity tokens and fetching tenancy context from the identity
service. Used by portal, worker, and product apps.

## Example

```ts
import { IdentityTokenValidator } from "@ma/identity-client";

const validator = new IdentityTokenValidator({
  jwksUrl: process.env.IDENTITY_JWKS_URL!,
  expectedAudience: "tasks",
  expectedIssuer: process.env.IDENTITY_ISSUER!
});

const identity = await validator.validateBearerToken(token);
```

Release the package using the steps in `docs/operations/sdk-release.md`.
