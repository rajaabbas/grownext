# Tasks Database Split Plan

## Table Ownership
- **Identity database** (`DATABASE_URL`): `organizations`, `organization_members`, `organization_invitations`, `user_profiles`, `tenants`, `tenant_members`, `tenant_applications`, `products`, `product_entitlements`, `refresh_tokens`, `audit_events`, plus the related enums.
- **Tasks database** (`TASKS_DATABASE_URL`): `tasks` table and the `TaskStatus` enum. Records continue to carry references (`organization_id`, `tenant_id`, `created_by_id`, `assigned_to_id`) but cross-database constraints are removed.

## Runtime Touch Points Using Tasks Data Today
- **apps/tasks** API routes (`app/api/tasks/*`): CRUD operations via `@ma/tasks-db` and tenancy context fetched from the identity HTTP API (`/internal/tasks/context`).
- **apps/worker** (`src/index.ts`): onboarding job calls `createTask`.
- **packages/db**: exports `tasks.ts`, seeds populate sample tasks, migrations define the `tasks` table, and Supabase policies guard access.
- **Supabase policies**: `supabase/policies/identity.sql` currently manages RLS for `core.tasks`.

## Separation Strategy
- Create a new workspace package `@ma/tasks-db` living at `packages/tasks-db` with its own Prisma schema, migrations, seed script, helpers, and generated client output directory.
- Prisma datasource will target `TASKS_DATABASE_URL` and use a dedicated Postgres schema (e.g. `tasks`). Authorization helpers mimic the identity package to keep RLS claims support.
- Remove task-specific models, exports, migrations, and policies from `@ma/db` so it focuses on identity concerns.
- Update applications/workers to depend on `@ma/tasks-db` for task persistence while retrieving identity data exclusively through HTTP clients (no direct `@ma/db` imports outside the identity service).

## Tooling & Operations
- Introduce environment variables: `TASKS_DATABASE_URL` (and optional `TASKS_DATABASE_DIRECT_URL` when using migrations).
- Add new pnpm scripts / CI steps to run tasks migrations, type checks, and seeds separately from identity.
- Document dual-database setup (local dev, Supabase config, backups) in project onboarding material.
