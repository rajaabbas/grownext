# Tasks App Runbook

The Tasks application demonstrates a tenancy-aware product built on top of the identity service. It owns its own PostgreSQL schema (`@ma/tasks-db`) and relies on identity for authorization context.

## Service Overview

- **Location**: `apps/tasks`
- **Build**: `pnpm build:tasks`
- **Port**: `TASKS_PORT` (default `3300`)
- **Datastores**: `TASKS_DATABASE_URL` (Postgres), optional Supabase project for auth helpers, Redis for background notifications
- **Dependencies**: Identity HTTP APIs (`/internal/tasks/context`, `/internal/tasks/users`), `@ma/tasks-db` Prisma client

## Database Ownership

- Tasks database stores: `tasks`, `projects`, `task_subtasks`, `task_comments`, `task_followers`, `task_permission_policies`, and supporting enums.
- Identity database remains the source of truth for organizations, tenants, entitlements, and user profiles. Cross-database foreign keys are intentionally absent—references are enforced at the application layer.

## Migrations & Seeds

```bash
pnpm tasks-db:migrate
pnpm tasks-db:seed
```

When schema changes land:

1. Update Prisma schema in `packages/tasks-db`.
2. Regenerate the client (`pnpm --filter @ma/tasks-db prisma:generate`).
3. Write migrations and run them in staging before production.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `TASKS_PRODUCT_SLUG` | Slug registered in identity entitlements (defaults to `tasks`) |
| `TASKS_DATABASE_URL` / `TASKS_DATABASE_DIRECT_URL` | Prisma datasource and migration target |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Identity service URL for fetching tenancy context |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional Supabase integration for client helpers |
| `REDIS_URL` | Queue connection for real-time notifications |

See [`../reference/env-vars.md`](../reference/env-vars.md) for full details.

## Operational Tasks

- **Enable app for a tenant**: Use the identity admin API (`/admin/tenants/:tenantId/apps`) or the Playwright helper `enableTenantApp`.
- **Grant entitlements**: Identity controls `ProductEntitlement`; ensure users have appropriate roles before debugging authorization errors.
- **Inspect queues**: Notification jobs enqueue to `task-notifications`; check worker logs if emails/alerts stop flowing.
- **Clone as template**: When building a new product, reference Tasks alongside the [Adding a Product App guide](../../architecture/adding-product-app.md) to mirror tenancy context fetching, queue usage, and Prisma packaging.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `Unauthorized` when calling `/api/tasks` | Session token missing or entitlement not granted; confirm identity context via `/internal/tasks/context`. |
| Prisma schema drift | Run `pnpm tasks-db:migrate status` and apply pending migrations; regenerate client. |
| Supabase errors in build | Ensure portal defaults in `next.config.cjs` remain, or set `NEXT_PUBLIC_SUPABASE_*` in CI. |
| Notifications not delivered | Confirm worker is running, Redis reachable, and queue jobs not blocked. |

For deeper architectural context, review the [platform architecture](../../overview/architecture.md) and the [permissions catalog](../../reference/permissions.md).
