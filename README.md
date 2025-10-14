# GrowNext Platform

A multi-product SaaS platform starter that ships with a central identity provider, a portal for tenant administration, and product application scaffolding. The repository is organized as a pnpm/Turborepo monorepo with strict TypeScript everywhere and shared packages for contracts, UI, configuration, database access, and the identity client SDK.

## Stack

- **Runtime**: Node.js 20+, pnpm 8, Turborepo
- **Identity**: Fastify service wrapping Supabase GoTrue, OAuth2/OIDC endpoints (`@ma/identity`)
- **Frontend**: Next.js App Router (portal + product apps), Tailwind CSS, shadcn/radix components via `@ma/ui`
- **Database**: PostgreSQL/Supabase — the identity service is the sole consumer of the `@ma/db` Prisma client, while the tasks app uses a dedicated `@ma/tasks-db` schema and talks back to identity via HTTP APIs
- **Queues**: BullMQ workers backed by Redis for asynchronous provisioning, invitation delivery, and tenant bootstrap tasks
- **Shared packages**: `@ma/contracts` (Zod schemas/OpenAPI), `@ma/identity-client` (token verification SDK + tenancy helpers), `@ma/config` (ESLint/TS/Prettier presets), `@ma/db` (identity Prisma client + helpers, used only inside the identity service), `@ma/tasks-db` (tasks Prisma client + helpers)
- **Testing**: Vitest (unit/integration), Playwright (optional e2e), ESLint + TypeScript strict mode

## Workspace Layout

```
apps/
  identity/   Fastify OIDC provider & admin APIs
  portal/     Next.js portal with SSO launcher, tenant & profile management
  tasks/      Tasks product app that resolves tenancy context via identity HTTP APIs and persists data with Prisma
  worker/     BullMQ processors + enqueue utility (tenant bootstrap, invitations)
packages/
  config/     Shared tsconfig/eslint/prettier presets
  contracts/  Zod schemas + OpenAPI fragments
  db/         Identity Prisma schema, migrations, Supabase helpers
  tasks-db/   Tasks Prisma schema, migrations, and helpers
  identity-client/  JWKS-backed token validator & middleware helpers
  ui/         Shared component library (Tailwind/shadcn based)
```

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Bootstrap environment variables**
   ```bash
   cp .env .env.local    # or edit the existing template
   ```
   Populate Supabase credentials (`SUPABASE_*`), database URL, Redis URL, and product client IDs (`TASKS_CLIENT_ID`, etc.). The defaults assume the local Supabase setup from `docker-compose.yml`.
3. **Run database migrations & seed sample data**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   pnpm tasks-db:migrate
   pnpm tasks-db:seed
   ```
4. **Start Supabase (optional)**
 ```bash
  docker compose up supabase -d
  npx supabase start -x storage realtime functions rest studio vector imgproxy inbucket edge-functions
  # optional: launch the tasks Supabase stack
  npx supabase start --config supabase/tasks/config.toml -x storage realtime functions rest studio vector imgproxy inbucket edge-functions
  ```
5. **Assign dev ports (optional but recommended when running multiple apps)**
   ```bash
   # bash/zsh
   set -a; source .env.dev; set +a
   ```
6. **Start the platform**
  ```bash
  pnpm dev
  ```
  The dev script loads `.env.dev`, assigns ports (`IDENTITY_PORT`, `PORTAL_PORT`, `TASKS_PORT`, etc.), and runs identity, portal, tasks, and worker concurrently. Add new product apps to `scripts/dev.mjs` if you introduce additional services. The tasks app reads `IDENTITY_BASE_URL` / `NEXT_PUBLIC_IDENTITY_BASE_URL` to call identity's `/internal/tasks/context` endpoint; the dev script wires these automatically for local separation.

7. **Explore the end-to-end flow**
   - Sign up or log in via the portal (`http://localhost:3200`) — Supabase sessions now drive all identity interactions.
   - Create tenants, grant entitlements, and inspect active sessions from the profile page.
   - Launch the Tasks product tile to interact with real task data persisted through Prisma models and secured by the identity service.

## Commands

- `pnpm dev` – run identity, portal, tasks (and other apps) in watch mode via Turbo
- `pnpm build` – build every workspace for production
- `pnpm test` – execute Vitest suites across apps and packages
- `pnpm lint` / `pnpm typecheck` – enforce linting and TypeScript invariants
- `pnpm db:migrate` / `pnpm db:seed` – manage identity Prisma migrations and seed data
- `pnpm tasks-db:migrate` / `pnpm tasks-db:seed` – manage Tasks Prisma migrations and seed data
- `pnpm --filter @ma/worker dev` – run BullMQ workers processing platform events

## Identity & Auth Flow (High Level)

| Step | Actor | Description |
| --- | --- | --- |
| 1 | Portal/Product | Redirects user to `/oauth/authorize` with PKCE challenge and client metadata. |
| 2 | Identity Service | Validates Supabase session, checks entitlements in Prisma, issues authorization code. |
| 3 | Portal/Product | Exchanges code at `/oauth/token`; identity service sets HttpOnly refresh token cookie and returns short-lived access & ID tokens. |
| 4 | Portal | Calls `/portal/launcher` to hydrate the UI with organizations, tenants, entitlements, and active sessions. |
| 5 | Tasks API / Worker | Exchanges the caller's Supabase access token for tenancy context by calling `/internal/tasks/context`, ensuring organization/tenant IDs and roles are sourced from identity. |
| 6 | Product API | Uses `@ma/identity-client` (`IdentityTokenValidator`) to verify the bearer token against JWKS and enforce roles before mutating data. |
| 7 | Identity Service | Records audit entries, maintains refresh token metadata, and enqueues downstream jobs. |
| 8 | Worker | Processes identity jobs (invitation emails, tenant bootstrap tasks) and writes follow-up records (e.g., default Tasks reminders). |

## Documentation

Detailed docs live in [`docs/`](docs):

- [`architecture.md`](docs/architecture.md) – service topology, request flows, and entity relationships.
- [`onboarding.md`](docs/onboarding.md) – environment setup, Supabase configuration, local workflows, and identity client usage.
- [`contributing.md`](docs/contributing.md) – branching, testing, and review guidelines.
- [`tasks-db-split.md`](docs/tasks-db-split.md) – details on the dual-database setup and operational playbooks.
- [`Agents.md`](docs/Agents.md) – guardrails for automation agents and cross-service communication rules.

## CI

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, typecheck, test, and build targets for the identity service, portal, and each product app. Ensure pipelines stay green before merging.

## Deployment Notes

- Identity service exposes Fastify HTTP endpoints; place behind HTTPS + gateway (e.g., Fly.io, Render, AWS ALB).
- Portal & product apps are standard Next.js builds (deploy to Vercel or containerize).
- Workers require Redis and the same environment variables as identity (to process audit/tenant events).
- Prisma migrations should be applied before rolling out new builds; include migration artifacts in PRs.
- Supabase must be configured with SMTP (for email) and MFA toggles to mirror production behavior.

## License

MIT — build on top of the platform and adapt it to your product needs.
