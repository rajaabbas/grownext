# Deployment & Production Readiness

Use this checklist when promoting GrowNext (identity, portal, admin, tasks, worker) into
production environments such as Fly.io, Render, or Kubernetes.

## 1. Core infrastructure

- Managed PostgreSQL instances for identity (`DATABASE_URL`) and tasks (`TASKS_DATABASE_URL`) with PITR or equivalent backups.
- Managed Redis instance for BullMQ (`REDIS_URL`) with `maxmemory-policy=noeviction`.
- Supabase project (publishable key + service-role key, SMTP provider configured).
- TLS-enabled domains for each surface (e.g. `identity.example.com`, `portal.example.com`, `admin.example.com`, `tasks.example.com`).

## 2. Build artifacts

```bash
pnpm install --frozen-lockfile
pnpm build         # or scoped variants: build:identity, build:portal, etc.
pnpm test          # ensure unit suites pass
pnpm --filter @ma/e2e run test:portal    # optional: run smoke e2e suite
```

Publish Docker images or tarballs through your preferred CI pipeline. The repo ships
with `render.yaml` as a baseline blueprint.

## 3. Database migration workflow

1. Run schema migrations against staging first:

   ```bash
   pnpm db:migrate
   pnpm tasks-db:migrate
   ```

2. Seed data is optional in production; use `pnpm seed` only for ephemeral preview/staging environments.
3. Regenerate Prisma clients on CI if the schema changes (`pnpm --filter @ma/db prisma:generate` and `pnpm --filter @ma/tasks-db prisma:generate`).

## 4. Secret management

Group secrets by service. Common settings:

| Variable | Services | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | all | Enables production optimizations. |
| `DATABASE_URL` | identity, worker | Identity prisma connection. |
| `TASKS_DATABASE_URL`, `TASKS_DATABASE_DIRECT_URL` | tasks, worker, identity | Product database connectivity. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | identity, worker | Service-role key is **only** for trusted services. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal, admin, tasks | Never expose service-role keys. |
| `IDENTITY_BASE_URL`, `NEXT_PUBLIC_IDENTITY_BASE_URL` | portal, admin, tasks | Public URL for the identity API. |
| `ADMIN_APP_URL` | admin | External URL used for email links/redirects. |
| `IDENTITY_ISSUER`, `IDENTITY_COOKIE_DOMAIN` | identity | Match your public domains. |
| `IDENTITY_JWT_PRIVATE_KEY`, `IDENTITY_JWT_PUBLIC_KEY` | identity, worker | Prefer RS256 in production. |
| `REDIS_URL` | identity, tasks, worker | Managed Redis connection string. |
| `TRUST_PROXY=true` | identity | Required when running behind load balancers. |
| `TASKS_PRODUCT_SLUG` | identity, tasks | Defaults to `tasks`; change if introducing additional products. |

See `docs/reference/env-vars.md` for exhaustive documentation.

## 5. Deploy

Example using Render:

1. Update `render.yaml` with production domains, health checks, and resources.
2. Run `render blueprint deploy render.yaml`.
3. Hook automatic deploys to your main branch once health checks are green.

For Kubernetes or Fly.io, adapt the same environment groups and startup commands
(`pnpm start` within each workspace).

## 6. Post-deploy validation

- **Identity service**
  - Validate `/health`, `/version`, and `/.well-known/openid-configuration`.
  - Perform a complete OAuth2 PKCE exchange and confirm refresh token issuance.
- **Portal**
  - Sign in, create a tenant, verify Launchpad stats/notifications, impersonation banner, and quick links.
  - Check Supabase session persistence across page reloads.
- **Admin**
  - Log in with a privileged account, confirm user search/detail pages load, start/stop an impersonation session, and kick off a bulk job (cancel once verified).
  - Ensure audit entries appear in the explorer and notifications surface job status updates.
- **Tasks**
  - Launch the app from the portal tile, create projects/tasks, ensure entitlements map to the correct tenant.
- **Worker**
  - Trigger a tenant creation and confirm the onboarding job is processed without retries.
  - Monitor queue length, retry counts, and Redis memory usage.

## 7. Observability & security

- Centralize logs and set alerts for 5xx spikes, queue lag, Supabase auth errors, and admin bulk-job failures.
- Enable HTTPS + HSTS; consider CSP/frame protections on portal/tasks.
- Configure Supabase email verification and MFA policies.
- Rotate JWT signing keys through a managed KMS and audit access to the service-role key.
- Document incident response and escalation paths (see `docs/operations/playbooks`).

## 8. Maintenance cadence

- Keep CI green (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
- Review dependency updates regularly (`pnpm outdated` / Dependabot).
- Revisit infrastructure sizing quarterly; monitor Postgres connection counts and Redis memory.
- Update documentation and release plans (`docs/meta/plans/`) when introducing significant features.

Use this guide alongside the runbooks in `docs/operations/` to keep production deployments consistent and auditable.
