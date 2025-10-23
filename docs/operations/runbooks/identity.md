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

## Security & Hardening Notes

- **Rate limiting**: `E2E_BYPASS_RATE_LIMIT` exists solely for Playwright suites. Leave it unset (or `false`) in every non-test environment so `/oauth/*` and `/saml/*` endpoints stay protected.
- **CORS**: Keep `API_CORS_ORIGINS` aligned with every deployed portal or product domain. Identity rejects unknown origins, so update the list before launching a new front-end.
- **Proxy awareness**: When deploying behind a load balancer, set `TRUST_PROXY=true` so Fastify reads `X-Forwarded-*` headers correctly for logging and rate-limit keys.
- **Signing keys**: Prefer RS256 (`IDENTITY_JWT_PRIVATE_KEY`/`IDENTITY_JWT_PUBLIC_KEY`) for production. Rotate keys via the procedures below and remind app teams to refresh cached JWKS.
- **Secrets management**: Supabase service role keys and SAML certificates should live in your secrets manager, not committed `.env` files. Update the [environment reference](../reference/env-vars.md) whenever a new secret is introduced.

## Common Operations

- **Rotate signing keys**: Update env vars (`IDENTITY_JWT_*`), redeploy, notify consumers to refresh JWKS caches.
- **Purge expired authorization codes**: Invoke the scheduled job (or run the Prisma cleanup script) to remove stale rows; ensures PKCE table stays small.
- **Sync entitlements**: Use admin APIs to adjust `ProductEntitlement` records; re-run `/portal/launcher` to confirm portal reflects updates.
- **Monitor billing ingestion**: the `/internal/billing/usage/events` endpoint logs `billing_usage_event_drop` warnings when dedupe or validation skips events—alert if drops rise above zero.
- **Monitor billing usage ingestion**: `/internal/billing/usage/events` accepts batched payloads from product apps. Confirm `IDENTITY_BILLING_ENABLED`/`WORKER_BILLING_ENABLED` are set, watch for `Failed to resolve active billing subscription` errors in identity logs, and verify the `billing-usage` worker queue drains after spikes.

## Impersonation Safeguards

- Admin UI displays an always-on banner whenever an impersonation session is active. Use the inline **Stop impersonating** action to immediately revoke the token and emit an `IMPERSONATION_STOPPED` audit event.
- Sessions are time boxed. The banner shows a live countdown and automatically clears the session (calling the DELETE endpoint) when the timer elapses.
- All stop actions (manual or auto-expire) must be confirmed in the audit explorer. Investigate any session without an explicit stop event.
- Operators should review the impersonation safeguards section before sharing session links. Never forward links outside secured support channels.

## Bulk Job Command Center

- Bulk jobs queue asynchronously; the admin console polls for progress and surfaces streaming status updates from the worker queue.
- Use the status/action filters to narrow large histories, then open the detail drawer for per-job diagnostics (failure breakdowns, export links, progress messages).
- Export jobs produce signed CSV URLs. Download directly from the drawer and note the expiry time before sharing with stakeholders.
- If a job stalls, check the worker runbook for queue health, then retry via the identity API once underlying issues are resolved.
- Progress broadcasts are published to the `super-admin.bulk-job.status` Redis channel for downstream dashboards and alerting.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `Provide IDENTITY_JWT_SECRET…` during boot | Ensure required env vars are set (tests use defaults in `vitest.setup.ts`). |
| `Unauthorized` responses in portal during build | Check Supabase env vars; Next.js prerender requires `NEXT_PUBLIC_SUPABASE_*`. |
| Queue backlog | Inspect BullMQ UI or Redis keys, scale worker instances, verify Redis memory and `maxmemory-policy`. |
| SAML assertion failures | Confirm metadata (entity ID, ACS URL), certificate validity, and clock skew; check `SamlConnection` rows. |

## Adding Another App

When onboarding a new product, follow the [Adding a Product App](../../architecture/adding-product-app.md) guide. Identity changes typically include:

- Creating a dedicated `internal/<product>` router for tenancy context.
- Exposing admin APIs for provisioning and entitlements.
- Registering background jobs via `createIdentityQueues()`.

Document any new endpoints or environment flags immediately so the rest of the platform can operate the service.

Escalate to the platform team if rotating keys or manipulating entitlements affects multiple tenants. Keep audit trails updated after manual interventions.
