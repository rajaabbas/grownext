# Environment Variables Reference

This reference centralizes the environment variables used across GrowNext services. Values shown here are representative defaults—store real secrets in a manager such as Render environment groups, Doppler, or Vault.

## Identity (`apps/identity`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `IDENTITY_PORT` | HTTP port | `3100` |
| `IDENTITY_BASE_URL` | Public URL for building links | `http://localhost:3100` |
| `IDENTITY_ISSUER` | JWT issuer claim | `http://localhost:3100` |
| `IDENTITY_COOKIE_DOMAIN` | Cookie scope for refresh tokens | `.localhost` |
| `IDENTITY_JWT_ALG` | Signing algorithm (`HS256` or `RS256`) | `HS256` (tests) |
| `IDENTITY_JWT_KID` | Active JWK key id | `identity-rs256` |
| `IDENTITY_JWT_SECRET` | HS256 signing secret (32+ chars) | `0123456789abcdef0123456789abcdef` |
| `IDENTITY_JWT_PRIVATE_KEY` / `IDENTITY_JWT_PUBLIC_KEY` | RS256 keys (optional) | — |
| `IDENTITY_JWKS_URL` | JWKS endpoint advertised by Identity | `http://localhost:3100/.well-known/jwks.json` |
| `IDENTITY_SAML_ENABLED` | Toggle SAML flows | `false` |
| `IDENTITY_SAML_SP_ENTITY_ID` | SP entity ID | `urn:grownext:identity` |
| `IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY` / `IDENTITY_SAML_SP_SIGNING_CERT` | SP signing materials | — |
| `IDENTITY_SAML_NAMEID_FORMAT` | NameID format when issuing assertions | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |
| `DATABASE_URL` | Identity Postgres connection string | `postgresql://.../identity` |
| `REDIS_URL` | BullMQ coordination | `redis://localhost:6379` |
| `IDENTITY_PAYMENT_PROVIDER` | Payment provider slug (`stripe`, etc.) | unset / `stripe` |
| `IDENTITY_PAYMENT_PROVIDER_API_KEY` | Provider secret used by the adapter | — |
| `IDENTITY_PAYMENT_PROVIDER_WEBHOOK_SECRET` | Signature secret for webhook validation | — |
| `IDENTITY_ACCESS_TOKEN_TTL_SECONDS` | Lifespan for access tokens | `300` |
| `IDENTITY_REFRESH_TOKEN_TTL_SECONDS` | Lifespan for refresh tokens | `2592000` |
| `IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS` | Lifespan for OAuth authorization codes | `120` |
| `IDENTITY_BILLING_ENABLED` | Enables billing adapters and routes | `false` |
| `SUPER_ADMIN_IMPERSONATION_SECRET` | HMAC secret for impersonation token signing | `super-admin-impersonation-secret-0123456789` |
| `SUPER_ADMIN_IMPERSONATION_BASE_URL` | Base URL for generating impersonation return links | `http://localhost:3500` |
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
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity API base URL | `http://localhost:3100` |
| `PORTAL_SESSION_SECRET` | Custom session storage secret (if used) | — |
| `APP_BASE_URL` | Canonical portal URL | `http://localhost:3200` |
| `NEXT_PUBLIC_PORTAL_URL` | Public portal origin exposed to other apps | `http://localhost:3200` |
| `PORTAL_LIGHTHOUSE_URL` | Target URL for CI Lighthouse snapshots | `http://localhost:3200` |

## Admin (`apps/admin`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `ADMIN_PORT` | HTTP port | `3500` |
| `ADMIN_APP_URL` / `NEXT_PUBLIC_ADMIN_APP_URL` | Canonical admin URL used in emails/links | `http://localhost:3500` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase config for client fetches | `https://example.supabase.co`, `anon` |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity API base URL | `http://localhost:3100` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server-side Supabase client configuration | `https://example.supabase.co`, `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Only required for privileged admin mutations | `service` |
| `IDENTITY_BASE_URL` | Used for server-side calls during SSR/routers | `http://localhost:3100` |
| `ADMIN_BILLING_ENABLED` | Enables Super Admin billing surfaces | `false` |
| `NEXT_PUBLIC_ADMIN_BILLING_ENABLED` | Mirrors `ADMIN_BILLING_ENABLED` for the client bundle | `false` |
| `NEXT_PUBLIC_PORTAL_URL` | Portal base URL used for CTAs and redirects | `http://localhost:3200` |
| `NEXT_PUBLIC_SUPERADMIN_IMPERSONATION` | Toggle impersonation features in settings UI | `true` |
| `NEXT_PUBLIC_SUPERADMIN_AUDIT_EXPORTS` | Toggle audit export UI | `true` |
| `NEXT_PUBLIC_TELEMETRY_ENDPOINT` | Optional OTLP/observability endpoint | unset / `http://localhost:4318/v1/traces` |

## Tasks (`apps/tasks`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `TASKS_PORT` | HTTP port | `3300` |
| `TASKS_PRODUCT_SLUG` | Product slug registered in identity | `tasks` |
| `TASKS_CLIENT_ID` | OAuth client id used during product grants | `tasks` |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity service URL | `http://localhost:3100` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server-side Supabase configuration | `https://example.supabase.co`, `anon` |
| `SUPABASE_PROJECT_URL` | Optional override for Supabase URL resolution | `https://example.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Supabase access for server actions | `service` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase config for client helpers | `https://example.supabase.co`, `anon` |
| `DATABASE_URL` | Identity Postgres connection string (shared) | `postgresql://.../identity` |
| `TASKS_DATABASE_URL` | Product Postgres connection string | `postgresql://.../tasks` |
| `TASKS_DATABASE_DIRECT_URL` | Direct migration URL (optional) | — |
| `REDIS_URL` | Notification queue | `redis://localhost:6379` |
| `TASKS_REDIS_HEALTH_URL` | Optional Redis health check used by `/api/status` | `http://localhost:6380/healthz` |
| `TASKS_GRAFANA_DASHBOARD_URL` | Grafana dashboard link returned from `/api/status` | `https://grafana.example.com/d/tasks` |
| `SKIP_QUEUE_CONNECTION` | Skip queue wiring in local Next dev server | `true` (local) |
| `TASKS_APP_URL` / `NEXT_PUBLIC_TASKS_APP_URL` | Public Tasks app URL | `http://localhost:3300` |
| `TASKS_API_URL` | Direct API base (used when overriding status link) | `http://localhost:3300/api` |
| `TASKS_STATUS_URL` / `NEXT_PUBLIC_TASKS_STATUS_URL` | Status endpoint consumed by other apps | `http://localhost:3300/api/status` |

## Worker (`apps/worker`)

| Variable | Description | Default / Example |
| --- | --- | --- |
| `REDIS_URL` | BullMQ connection | `redis://localhost:6379` |
| `IDENTITY_BASE_URL` | Identity API base for HTTP calls | `http://localhost:3100` |
| `DATABASE_URL` | Identity Postgres (read operations) | `postgresql://.../identity` |
| `TASKS_DATABASE_URL` | Tasks Postgres | `postgresql://.../tasks` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase privileged access | `service` |
| `TASKS_PRODUCT_SLUG` | Product slug used by bootstrap jobs | `tasks` |
| `WORKER_BILLING_ENABLED` | Toggle billing processors/queues | `false` |
| `ENQUEUE_QUEUE` / `ENQUEUE_EVENT` / `ENQUEUE_EMAIL` | Helpers for `pnpm enqueue` CLI smoke tests | `user-management`, `manual-test`, `user@example.com` |
| `ENQUEUE_JOB_ID` | Optional custom BullMQ job id | — |
| `IDENTITY_EVENT_TYPE` / `IDENTITY_ORG_ID` | Seed values when enqueueing identity webhooks | `tenant.provisioned`, `org-1` |
| `BILLING_JOB_PAYLOAD` | Raw JSON payload for billing queue enqueue | `{}` |

## Global

| Variable | Description | Default / Example |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `NODE_VERSION` | Optional pin for CI runners | Align with local toolchain |
| `APP_VERSION` | Populated during builds | `0.0.1` |
| `NEXT_PUBLIC_API_BASE_URL` | Convenience alias for Identity API (mostly E2E) | `http://localhost:3100` |

## QA / E2E

| Variable | Description | Default / Example |
| --- | --- | --- |
| `E2E_SUPABASE_URL` | Supabase instance used by Playwright tests | `http://127.0.0.1:54321` |
| `E2E_SUPABASE_ANON_KEY` | Public key for the E2E Supabase project | `anon` |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Service role key for seeding fixtures | — |
| `E2E_ADMIN_BASE_URL` | Super Admin UI base URL under test | `http://localhost:3500` |
| `E2E_API_BASE_URL` | Identity API base URL under test | `http://localhost:3100` |
| `E2E_API_HEALTH_URL` | API health endpoint for readiness checks | `http://localhost:3100/healthz` |
| `E2E_PORTAL_HEALTH_URL` | Portal health endpoint used in setup | `http://localhost:3200/api/status` |
| `E2E_TASKS_BASE_URL` | Tasks app base URL under test | `http://localhost:3300` |
| `E2E_TASKS_HEALTH_URL` | Tasks status endpoint | `http://localhost:3300/api/status` |
| `E2E_TASKS_PRODUCT_SLUG` | Product slug expected in seeded data | `tasks` |
| `E2E_WEB_SERVER` / `E2E_WEB_PORT` | Playwright web server command + port | `pnpm dev`, `3200` |
| `E2E_ENV_PATH` | Path to env file consumed by Playwright | `.env` |

## Tips

- Keep `.env` checked in with sensible defaults, `.env.local` ignored, and CI jobs defining secrets through the platform.
- When running tests, defaults are injected via each app’s Vitest setup to prevent missing env failures.
- Update this reference whenever a new config flag is introduced.
