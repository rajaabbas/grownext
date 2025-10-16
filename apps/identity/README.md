# Identity Service

Fastify-based OIDC provider that wraps Supabase GoTrue as the source of truth for accounts, MFA, and sessions. The service issues short-lived access tokens, manages refresh tokens via secure cookies, and exposes admin APIs for organizations, tenants, products, and entitlements.

## Responsibilities

- Implement OAuth2/OIDC endpoints (`/oauth/authorize`, `/oauth/token`, `/userinfo`)
- Proxy trusted operations to Supabase while executing domain logic in Prisma/Postgres
- Manage tenant, invitation, and entitlement administration APIs
- Emit audit events for sign-ins, token issuance, admin actions, and SAML assertions
- Manage per-organization SAML 2.0 connections (metadata ingestion, /saml metadata/login/ACS handlers)

## Local Development

```bash
pnpm dev --filter @ma/identity
```

Environment variables are loaded from the workspace `.env`. Ensure Supabase services are running (`docker compose up supabase`) before starting the identity server.
