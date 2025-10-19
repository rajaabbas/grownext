# Getting Started

This guide walks through the steps required to clone the repository, configure local infrastructure, and explore the GrowNext platform end‑to‑end.

## 1. Prerequisites

- Node.js 20.11+ (see `.nvmrc`)
- pnpm 8+
- Docker (for Supabase + Postgres)
- Redis (a local `redis-stack` container works well)
- Supabase CLI (optional but recommended)

## 2. Install Dependencies

```bash
pnpm install
# or install only what you need
pnpm install:identity
pnpm install:tasks
```

## 3. Configure Environment Variables

1. Copy `.env` to `.env.local` and tailor secrets for your environment.
2. Required values include Supabase keys (`SUPABASE_*`), product client IDs (`TASKS_CLIENT_ID`, etc.), and optional SAML settings (`IDENTITY_SAML_SP_*`).
3. When running multiple services together, source `.env.dev` to assign non-conflicting ports:

```bash
set -a; source .env.dev; set +a
```

Refer to [`../reference/env-vars.md`](../reference/env-vars.md) for full variable descriptions.

## 4. Start Local Infrastructure

```bash
docker compose up supabase -d
```

The default compose file starts Supabase (Postgres + GoTrue). When testing Tasks against its own Supabase stack, use `supabase/tasks/config.toml` with the Supabase CLI.

## 5. Run Migrations & Seeds

```bash
pnpm db:migrate && pnpm db:seed
pnpm tasks-db:migrate && pnpm tasks-db:seed
# shortcut for both
pnpm seed
```

Identity data lives in `DATABASE_URL` via `@ma/db`; Tasks data uses `TASKS_DATABASE_URL` via `@ma/tasks-db`.

## 6. Launch the Platform

```bash
pnpm dev
```

This starts identity, portal, tasks, and worker in watch mode after loading `.env.dev`. Use the scoped scripts if you only need a subset:

- `pnpm dev:identity`
- `pnpm dev:portal`
- `pnpm dev:tasks`
- `pnpm dev:worker`

## 7. Explore the Workflow

1. Visit `http://localhost:3200` to sign up/sign in via Supabase.
2. Create an organization, add tenants, and launch the Tasks application tile.
3. In Tasks:
   - experiment with list/board/My Tasks views,
   - create projects and tasks,
   - add comments, subtasks, followers, and change priority/visibility,
   - review permissions at `/tasks/settings?tenantId=<tenant>`.
4. Inspect portal profile pages for session management, or trigger a password reset from `/login`.
5. Optional: configure SAML via `/admin/organizations/:id/saml/connections` and test `/saml/:slug/login`.

## 8. Common Commands

| Command | Description |
| --- | --- |
| `pnpm build` | Build every workspace (`pnpm build:<service>` for scoped builds). |
| `pnpm test` | Run all Vitest suites (`pnpm test:<service>` for a single app). |
| `pnpm lint` / `pnpm typecheck` | Execute ESLint and TypeScript checks. |
| `pnpm --filter @ma/worker dev` | Run BullMQ workers. |
| `pnpm --filter @ma/e2e test:<suite>` | Execute Playwright suites once the dev servers are running. |

## 9. Supabase Tips

- Enable email verification/MFA inside Supabase to mirror production behaviour.
- Portal profile pages call Supabase-admin endpoints through the identity service—verify service keys are present.
- When running the Tasks Supabase stack, remember to point `TASKS_DATABASE_URL` and the Supabase CLI at the dedicated `tasks` schema.

## 10. Next Steps

- Ready to deploy? Continue with [`deployment.md`](./deployment.md).
- Curious about architecture or service ownership? See [`../overview/platform-components.md`](../overview/platform-components.md).
- Need runbooks or operational guidance? Visit [`../operations/runbooks/`](../operations/runbooks/).
