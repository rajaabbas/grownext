# Deployment & Production Readiness

Follow this checklist to move GrowNext (identity, portal, tasks, worker) into a managed environment such as Render, Fly.io, or your preferred Kubernetes stack.

## 1. Prerequisites

- Managed PostgreSQL instances for identity (`DATABASE_URL`) and tasks (`TASKS_DATABASE_URL`) with backups + PITR.
- Managed Redis for BullMQ (set `maxmemory-policy=noeviction`).
- Supabase project (anon + service-role keys, email provider configured).
- Production domains, e.g. `identity.example.com`, `portal.example.com`, `tasks.example.com`.
- Tooling: `pnpm`, Supabase CLI, `turbo`, `openssl`.

## 2. Database & Schema Preparation

```bash
pnpm db:migrate
pnpm tasks-db:migrate
# optional seed data
pnpm seed
```

- Confirm the `authorization_codes` table exists in the identity database.
- Regenerate Prisma clients if the schema changed (`pnpm --filter @ma/db generate`, `pnpm --filter @ma/tasks-db generate`).

## 3. Secrets & Environment Variables

Create environment groups (or Kubernetes secrets) for shared values.

| Variable | Services | Notes |
| --- | --- | --- |
| `NODE_ENV` | all | `production` |
| `DATABASE_URL` | identity, worker | Identity database connection string |
| `TASKS_DATABASE_URL`, `TASKS_DATABASE_DIRECT_URL` | tasks, worker, identity | Product database |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | identity, worker | Service role key only for trusted services |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal, tasks | Never expose service-role key |
| `IDENTITY_BASE_URL`, `NEXT_PUBLIC_IDENTITY_BASE_URL` | portal, tasks | e.g. `https://identity.example.com` |
| `IDENTITY_ISSUER` | identity | Matches public identity URL |
| `IDENTITY_COOKIE_DOMAIN` | identity | Apex domain for cookie scope |
| `IDENTITY_JWT_SECRET` *or* `IDENTITY_JWT_PRIVATE_KEY`/`IDENTITY_JWT_PUBLIC_KEY` | identity, worker | Prefer RS256 in production |
| `REDIS_URL` | identity, tasks, worker | Managed Redis instance |
| `TRUST_PROXY` | identity | `true` behind managed proxies |
| `TASKS_PRODUCT_SLUG` | identity, tasks | Defaults to `tasks` |

See [`../reference/env-vars.md`](../reference/env-vars.md) for the full catalog.

## 4. Build & Deploy (Render Example)

1. Customize `render.yaml`:
   - Update domains and `API_CORS_ORIGINS`.
   - Point `REDIS_URL` values to your managed instance.
   - Confirm plan sizes for each service.
2. Deploy:

```bash
render blueprint deploy render.yaml
```

3. Verify each service builds from a clean checkout (`pnpm install --frozen-lockfile`).
4. Enable automatic deploys from your main branch once stable.

## 5. Post-Deployment Validation

- **Identity**
  - Hit `/health`, `/version`, and `.well-known/openid-configuration`.
  - Run an authorization code flow end‑to‑end.
  - Restart pods and confirm PKCE exchanges succeed (authorization codes persisted).
- **Portal & Tasks**
  - Sign in/out, create tenants, entitlements, and open the Tasks app.
  - Ensure logout clears Supabase sessions and workers receive onboarding jobs.
- **Worker**
  - Trigger a tenant creation and confirm jobs process without retries.
  - Monitor BullMQ metrics (latency, retries) and Redis memory usage.
- **Observability**
  - Hook logs to centralized tooling; set alerts for 5xx spikes, queue lag, and auth failures.

## 6. Security & Compliance

- Enforce HTTPS + HSTS; add CSP/X-Frame headers via middleware if needed.
- Enable Supabase email verification + MFA; configure SMTP providers.
- Rotate JWT signing keys (ideally RS256 via managed KMS).
- Schedule pruning of expired authorization codes and refresh tokens.
- Document incident response, access reviews, and compliance requirements.

## 7. Operational Runbooks

- Maintain playbooks for deploy/rollback, database migrations, queue backlog investigation, and Supabase outages (see [`../operations/runbooks`](../operations/runbooks)).
- Define KPIs (auth success rate, queue latency, Supabase error codes) and set up alert routing.
- Establish on-call rotations and escalation channels.

## 8. Ongoing Maintenance

- Track dependency updates (`pnpm outdated`, Dependabot).
- Keep CI green (lint, typecheck, unit tests, end-to-end smoke tests).
- Review environment and secret sprawl periodically.
- Monitor infrastructure metrics (CPU, memory, connection pools) and right-size before saturation.

Once everything is validated, you’re ready to route production traffic. Treat this guide as living documentation—update it whenever you adopt a new host, change infrastructure, or tighten compliance controls.
