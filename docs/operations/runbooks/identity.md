# Identity Service Runbook

GrowNext’s identity service is a Fastify application that fronts Supabase GoTrue, issues OAuth2/OIDC tokens, and brokers SAML flows. Use this runbook for common operational tasks.

## Service Overview

- **Location**: `apps/identity`
- **Artifacts**: Docker image or Render service built via `pnpm build:identity`
- **Ports**: `IDENTITY_PORT` (default `4000`)
- **Datastores**: `DATABASE_URL` (Postgres), `REDIS_URL` (queue coordination), Supabase project
- **Queues**: Emits jobs to BullMQ (`identity-events`, `user-management-jobs`)

## Health & Diagnostics

- `GET /health` – lightweight readiness probe
- `GET /version` – build metadata
- `GET /.well-known/openid-configuration` – OIDC discovery document
- `GET /.well-known/jwks.json` – signing JWKS

Monitor:

- 5xx rates on OAuth endpoints
- Queue backlog metrics (BullMQ) and Redis memory
- Supabase error codes (auth failures, rate limits)

## Start / Stop / Restart

```bash
pnpm dev:identity     # local
pnpm build:identity   # CI/CD
pnpm start            # runs dist/index.js
```

In production, restart through your orchestrator (Render, Kubernetes, etc.). Ensure graceful shutdown drains open HTTP requests and BullMQ producers.

## Configuration Snapshot

| Variable | Purpose |
| --- | --- |
| `IDENTITY_BASE_URL` | Public URL for building absolute links |
| `IDENTITY_ISSUER` | Issuer claim in JWTs |
| `IDENTITY_JWT_SECRET` **or** `IDENTITY_JWT_PRIVATE_KEY/PUBLIC_KEY` | Token signing; prefer RS256 in production |
| `IDENTITY_COOKIE_DOMAIN` | Cookie scope for refresh tokens |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | GoTrue integration |
| `API_CORS_ORIGINS` | Allowed front-end origins |
| `IDENTITY_SAML_ENABLED`, `IDENTITY_SAML_SP_*` | Toggle SAML + SP credentials |
| `REDIS_URL` | BullMQ queues |

Full catalog lives in [`../reference/env-vars.md`](../reference/env-vars.md).

## Common Operations

- **Rotate signing keys**: Update env vars (`IDENTITY_JWT_*`), redeploy, notify consumers to refresh JWKS caches.
- **Purge expired authorization codes**: Invoke the scheduled job (or run the Prisma cleanup script) to remove stale rows; ensures PKCE table stays small.
- **Sync entitlements**: Use admin APIs to adjust `ProductEntitlement` records; re-run `/portal/launcher` to confirm portal reflects updates.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `Provide IDENTITY_JWT_SECRET…` during boot | Ensure required env vars are set (tests use defaults in `vitest.setup.ts`). |
| `Unauthorized` responses in portal during build | Check Supabase env vars; Next.js prerender requires `NEXT_PUBLIC_SUPABASE_*`. |
| Queue backlog | Inspect BullMQ UI or Redis keys, scale worker instances, verify Redis memory and `maxmemory-policy`. |
| SAML assertion failures | Confirm metadata (entity ID, ACS URL), certificate validity, and clock skew; check `SamlConnection` rows. |

Escalate to the platform team if rotating keys or manipulating entitlements affects multiple tenants. Keep audit trails updated after manual interventions.
