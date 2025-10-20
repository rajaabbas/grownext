# Portal

Tenant-facing launcher and admin console. Renders the Launchpad dashboard,
impersonation banner, notifications, and tenant management flows on top of the
identity service.

## Run locally

```bash
pnpm dev --filter @ma/portal
```

Start Supabase (`docker compose up supabase -d`) and the identity service so the
portal can complete OAuth/OIDC exchanges.

## Docs

- Local setup: `docs/setup/local-development.md`
- Portal runbook: `docs/operations/runbooks/portal.md`
- Architecture overview: `docs/architecture/overview.md`
