# Environment Variables Reference

This reference centralizes the environment variables used across GrowNext services. Values shown here are representative defaults—store real secrets in a manager such as Render environment groups, Doppler, or Vault.

## Identity (`apps/identity`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `IDENTITY_PORT` | HTTP port | `4000` |
| `IDENTITY_BASE_URL` | Public URL for building links | `http://localhost:4000` |
| `IDENTITY_ISSUER` | JWT issuer claim | `http://localhost:4000` |
| `IDENTITY_COOKIE_DOMAIN` | Cookie scope for refresh tokens | `.localhost` |
| `IDENTITY_JWT_ALG` | Signing algorithm (`HS256` or `RS256`) | `HS256` (tests) |
| `IDENTITY_JWT_SECRET` | HS256 signing secret (32+ chars) | `0123456789abcdef0123456789abcdef` |
| `IDENTITY_JWT_PRIVATE_KEY` / `IDENTITY_JWT_PUBLIC_KEY` | RS256 keys (optional) | — |
| `IDENTITY_SAML_ENABLED` | Toggle SAML flows | `false` |
| `IDENTITY_SAML_SP_ENTITY_ID` | SP entity ID | `urn:grownext:identity` |
| `IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY` / `IDENTITY_SAML_SP_SIGNING_CERT` | SP signing materials | — |
| `DATABASE_URL` | Identity Postgres connection string | `postgresql://.../identity` |
| `REDIS_URL` | BullMQ coordination | `redis://localhost:6379` |
| `IDENTITY_PAYMENT_PROVIDER` | Payment provider slug (`stripe`, etc.) | unset / `stripe` |
| `IDENTITY_PAYMENT_PROVIDER_API_KEY` | Provider secret used by the adapter | — |
| `IDENTITY_PAYMENT_PROVIDER_WEBHOOK_SECRET` | Signature secret for webhook validation | — |
| `SUPER_ADMIN_IMPERSONATION_SECRET` | HMAC secret for impersonation token signing | `changeme-super-admin-secret` |
| `SUPABASE_URL` | Supabase project URL | `https://example.supabase.co` |
| `SUPABASE_ANON_KEY` | Public Supabase key | `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (trusted services only) | `service` |
| `API_CORS_ORIGINS` | Allowed front-end origins | `http://localhost:3200,http://localhost:3300` |
| `APP_BASE_URL` | Default front-end origin allowed by CORS | `http://localhost:3200` |
| `TRUST_PROXY` | Honor proxy headers in production | `false` (local) |
| `E2E_BYPASS_RATE_LIMIT` | Disable rate limiting for Playwright suites only | unset / `false` |

## Portal (`apps/portal`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `PORTAL_PORT` | HTTP port | `3200` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL for browser | `https://example.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `anon` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server-side Supabase (SSR/API routes) | `https://example.supabase.co` / `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional—only for privileged portal actions | `service` |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity API base URL | `http://localhost:4000` |
| `PORTAL_SESSION_SECRET` | Custom session storage secret (if used) | — |
| `APP_BASE_URL` | Canonical portal URL | `http://localhost:3200` |
| `PORTAL_LIGHTHOUSE_URL` | Target URL for CI Lighthouse snapshots | `http://localhost:3200` |

## Admin (`apps/admin`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `ADMIN_PORT` | HTTP port | `3500` |
| `ADMIN_APP_URL` | Canonical admin URL used in emails/links | `http://localhost:3500` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase config for client fetches | `https://example.supabase.co`, `anon` |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity API base URL | `http://localhost:4000` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server-side Supabase client configuration | `https://example.supabase.co`, `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Only required for privileged admin mutations | `service` |
| `IDENTITY_BASE_URL` | Used for server-side calls during SSR/routers | `http://localhost:4000` |
| `ADMIN_BILLING_ENABLED` | Enables Super Admin billing surfaces | `false` |
| `NEXT_PUBLIC_ADMIN_BILLING_ENABLED` | Mirrors `ADMIN_BILLING_ENABLED` for the client bundle | `false` |

## Tasks (`apps/tasks`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `TASKS_PORT` | HTTP port | `3300` |
| `TASKS_PRODUCT_SLUG` | Product slug registered in identity | `tasks` |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity service URL | `http://localhost:4000` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase config for client helpers | `https://example.supabase.co`, `anon` |
| `TASKS_DATABASE_URL` | Product Postgres connection string | `postgresql://.../tasks` |
| `TASKS_DATABASE_DIRECT_URL` | Direct migration URL (optional) | — |
| `REDIS_URL` | Notification queue | `redis://localhost:6379` |
| `TASKS_REDIS_HEALTH_URL` | Optional Redis health check used by `/api/status` | `http://localhost:6380/healthz` |
| `TASKS_GRAFANA_DASHBOARD_URL` | Grafana dashboard link returned from `/api/status` | `https://grafana.example.com/d/tasks` |

## Worker (`apps/worker`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `REDIS_URL` | BullMQ connection | `redis://localhost:6379` |
| `IDENTITY_BASE_URL` | Identity API base for HTTP calls | `http://localhost:4000` |
| `DATABASE_URL` | Identity Postgres (read operations) | `postgresql://.../identity` |
| `TASKS_DATABASE_URL` | Tasks Postgres | `postgresql://.../tasks` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase privileged access | `service` |
| `TASKS_PRODUCT_SLUG` | Product slug used by bootstrap jobs | `tasks` |
| `WORKER_BILLING_ENABLED` | Toggle billing processors/queues | `false` |

## Global

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `NODE_VERSION` | Align with `.nvmrc` in CI |
| `APP_VERSION` | Populated during builds (defaults to `0.0.1`) |

## Tips

- Keep `.env` checked in with sensible defaults, `.env.local` ignored, and CI jobs defining secrets through the platform.
- When running tests, defaults are injected via each app’s Vitest setup to prevent missing env failures.
- Update this reference whenever a new config flag is introduced.
