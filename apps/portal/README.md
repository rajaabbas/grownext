# Portal App

The portal is the tenant-facing launcher and admin console that orchestrates authentication, MFA, and product discovery flows on top of the identity service.

## Responsibilities

- Deliver SSO entry points (sign-in, sign-up, MFA) for end users
- Provide organization and tenant management tooling for administrators
- Surface entitled products with deep links into each application
- Offer profile management including session revocation, MFA enrollment, and API key rotation

## Local Development

```bash
pnpm dev --filter @ma/portal
```

Run the identity service alongside the portal to ensure the OIDC flows and token exchange APIs are available locally.
