# GrowNext Production Readiness Checklist

This guide summarizes the steps required to launch the GrowNext platform (identity, portal, tasks, worker) in a production environment such as Render. Work through each section before routing live traffic.

## 1. Prerequisites

- Provision managed PostgreSQL for both identity (`DATABASE_URL`) and tasks (`TASKS_DATABASE_URL`). Enable backups and point-in-time recovery.
- Create a managed Redis instance for BullMQ. Set `maxmemory-policy` to `noeviction`.
- Set up a Supabase project (authentication, storage) and capture the anon and service-role keys.
- Decide on production domains, e.g. `identity.example.com`, `portal.example.com`, `tasks.example.com`.
- Install required tooling locally: `pnpm`, `supabase` CLI, `turbo`, `openssl`.

## 2. Database & Schema Preparation

1. Apply the latest Prisma migrations to both databases:
   ```bash
   pnpm db:migrate
   pnpm tasks-db:migrate
   ```
2. Confirm the `authorization_codes` table exists in the `core` schema (introduced for OIDC code flow persistence).
3. Regenerate Prisma clients if schema changed:
   ```bash
   pnpm --filter @ma/db generate
   pnpm --filter @ma/tasks-db generate
   ```
4. Seed optional sample data if needed:
   ```bash
   pnpm seed
   ```

## 3. Secrets & Environment Variables

Create Render environment groups (or equivalents) for shared secrets. Populate the following (values will differ per service):

| Variable | Services | Notes |
| --- | --- | --- |
| `NODE_ENV` | all | set to `production` |
| `NODE_VERSION` | all | align with `.nvmrc` (20.11.x) |
| `DATABASE_URL` | identity, worker, tasks | identity DB endpoint |
| `TASKS_DATABASE_URL`, `TASKS_DATABASE_DIRECT_URL` | tasks, worker, identity | tasks DB endpoints |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | identity, worker | service role only for trusted services |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal, tasks | never expose service role keys client-side |
| `IDENTITY_BASE_URL`, `NEXT_PUBLIC_IDENTITY_BASE_URL` | portal, tasks | e.g. `https://identity.example.com` |
| `APP_BASE_URL` | identity | primary portal URL |
| `API_CORS_ORIGINS` | identity | comma-separated list of all frontends |
| `IDENTITY_COOKIE_DOMAIN` | identity | apex domain for cookie scope |
| `IDENTITY_ISSUER` | identity | matches public identity URL |
| `IDENTITY_JWT_SECRET` *or* `IDENTITY_JWT_PRIVATE_KEY`/`IDENTITY_JWT_PUBLIC_KEY` | identity, worker | prefer RS256 in production |
| `REDIS_URL` | identity, tasks, worker | Redis connection string |
| `TRUST_PROXY` | identity | set to `true` behind Render’s proxy |
| `TASKS_PRODUCT_SLUG` | identity, tasks | defaults to `tasks` |

Rotate secrets via your secret manager; never commit them to Git.

## 4. Build & Deploy (Render Example)

1. Add `render.yaml` to the repo (already provided) and customize:
   - Replace placeholder domains, update `API_CORS_ORIGINS`.
   - Confirm `plan` selections match your Render tier.
   - Point `REDIS_URL` entries to the provisioned Redis service.
2. Deploy with the Render CLI or dashboard:
   ```bash
   render blueprint deploy render.yaml
   ```
3. Verify each service builds from a clean checkout (`pnpm install --frozen-lockfile`).
4. Enable automatic deploys from your main branch once the pipeline is stable.

## 5. Post-Deployment Validation

- Identity service:
  - Hit `/health` and `/version` endpoints.
  - Confirm `.well-known/openid-configuration` publishes correct issuer and JWKS.
  - Run an OAuth authorization code flow end-to-end (portal login → identity → callback).
  - Ensure authorization codes persist across restarts (no more in-memory loss).
- Portal & Tasks:
  - Sign in via Supabase, verify CSRF protections block missing `X-Requested-With`.
  - Provision new organization and tenant, grant task entitlements, open the tasks app.
  - Confirm logout clears Supabase session and redirects appropriately.
- Worker:
  - Trigger a tenant creation to enqueue onboarding jobs.
  - Inspect BullMQ dashboards or Redis keys for active jobs / failures.
- Logs & metrics:
  - Attach Render log drains or observability tooling.
  - Set alerts on 5xx rates, queue lag, and error logs from identity/worker.

## 6. Security & Compliance Hardening

- Force HTTPS and HSTS (Render settings or reverse proxy). Add CSP, X-Frame-Options, and other security headers in Next.js middleware if required.
- Enable Supabase email verification, MFA, and configure SMTP.
- Consider migrating token signing to RS256 with managed key storage.
- Schedule periodic pruning of expired authorization codes and refresh tokens (e.g. cron hitting an admin endpoint or background worker job).
- Document key rotation, incident response, and access reviews.

## 7. Operational Runbooks

- Maintain playbooks for:
  - Deployments and rollbacks.
  - Database migrations (ensure zero-downtime strategy).
  - Queue backlog investigation.
  - Supabase outage handling and fallback.
- Define observability KPIs (auth success rate, queue latency, identity API p95).
- Establish on-call rotation and escalation channels.

## 8. Ongoing Maintenance

- Keep dependencies updated (`pnpm outdated`, Dependabot).
- Run lint, typecheck, unit, and integration suites as part of CI (ensuring they pass before deploy).
- Periodically audit environment variables and secrets for sprawl.
- Review Render service metrics (memory, CPU) to adjust plans before saturation.

---

Once all steps are complete and validated, the platform is ready for production traffic. Keep this checklist with deployment runbooks so future releases stay compliant and secure.
