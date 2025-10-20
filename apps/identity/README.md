# Identity Service

Fastify service that fronts Supabase GoTrue, exposes OAuth2/OIDC + SAML endpoints,
and manages organizations, tenants, products, and entitlements.

## Run locally

```bash
pnpm dev --filter @ma/identity
```

Ensure Supabase is running and the service-role token in `.env` is valid (see
`docs/setup/local-development.md`).

## Docs

- Identity runbook: `docs/operations/runbooks/identity.md`
- Architecture overview: `docs/architecture/overview.md`
- Prisma upgrade playbook: `docs/operations/prisma-upgrade.md`
