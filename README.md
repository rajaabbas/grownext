# GrowNext Platform

A multi-product SaaS platform starter that ships with a central identity provider, a portal for tenant administration, and product application scaffolding. The repository is organized as a pnpm/Turborepo monorepo with strict TypeScript everywhere and shared packages for contracts, UI, configuration, database access, and the identity client SDK.

## Stack

- **Runtime**: Node.js 20+, pnpm 8, Turborepo
- **Identity**: Fastify service wrapping Supabase GoTrue, OAuth2/OIDC endpoints (`@ma/identity`)
- **Frontend**: Next.js App Router (portal + product apps), Tailwind CSS, shadcn/radix components via `@ma/ui`
- **Database**: PostgreSQL/Supabase, Prisma schema with tenants/products/entitlements/audit tables
- **Queues**: BullMQ workers backed by Redis for asynchronous provisioning & notifications
- **Shared packages**: `@ma/contracts` (Zod schemas/OpenAPI), `@ma/identity-client` (token verification SDK), `@ma/config` (ESLint/TS/Prettier presets), `@ma/db` (Prisma client + helpers)
- **Testing**: Vitest (unit/integration), Playwright (optional e2e), ESLint + TypeScript strict mode

## Workspace Layout

```
apps/
  identity/   Fastify OIDC provider & admin APIs
  portal/     Next.js portal with SSO launcher, tenant & profile management
  tasks/      Example product app (task tracker) demonstrating identity integration
  worker/     BullMQ processors + enqueue utility
packages/
  config/     Shared tsconfig/eslint/prettier presets
  contracts/  Zod schemas + OpenAPI fragments
  db/         Prisma schema, migrations, Supabase helpers
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
   pnpm --filter @ma/db prisma migrate dev --name bootstrap
   pnpm db:seed
   ```
4. **Start Supabase (optional)**
   ```bash
   docker compose up supabase -d
   npx supabase start -x storage realtime functions rest studio vector imgproxy inbucket edge-functions
   ```
5. **Assign dev ports (optional but recommended when running multiple apps)**
   ```bash
   # bash/zsh
   set -a; source .env.dev; set +a
   ```
6. **Start the platform**
   ```bash
   PORT=$IDENTITY_PORT pnpm --filter @ma/identity dev &
   PORT=$PORTAL_PORT pnpm --filter @ma/portal dev &
   PORT=$TASKS_PORT pnpm --filter @ma/tasks dev &
   wait
   ```
   - Launch other apps the same way if you add additional product surfaces.
   - If you expose a standalone API service, bind it to `API_PORT`.
   - Workers don’t serve HTTP, but you can pass `WORKER_PORT` to any tooling that expects a unique identifier.

## Commands

- `pnpm dev` – run identity, portal, tasks (and other apps) in watch mode via Turbo
- `pnpm build` – build every workspace for production
- `pnpm test` – execute Vitest suites across apps and packages
- `pnpm lint` / `pnpm typecheck` – enforce linting and TypeScript invariants
- `pnpm db:migrate` / `pnpm db:seed` – manage Prisma migrations and seed data
- `pnpm --filter @ma/worker dev` – run BullMQ workers processing platform events

## Identity & Auth Flow (High Level)

| Step | Actor | Description |
| --- | --- | --- |
| 1 | Portal/Product | Redirects user to `/oauth/authorize` with PKCE challenge and client metadata. |
| 2 | Identity Service | Validates Supabase session, checks entitlements in Prisma, issues authorization code. |
| 3 | Portal/Product | Exchanges code at `/oauth/token`; identity service sets HttpOnly refresh token cookie and returns short-lived access & ID tokens. |
| 4 | Product API | Uses `@ma/identity-client` (`IdentityTokenValidator`) to verify the bearer token against JWKS and enforce roles. |
| 5 | Identity Service | Logs `TOKEN_ISSUED`/`TOKEN_REFRESHED` audit events, stores refresh token metadata. |
| 6 | Worker | Processes downstream identity jobs (tenant provisioning, invitation dispatch, audit fan-out). |

## Documentation

Detailed docs live in [`docs/`](docs):

- [`architecture.md`](docs/architecture.md) – service topology, request flows, and entity relationships.
- [`onboarding.md`](docs/onboarding.md) – environment setup, Supabase configuration, local workflows, and identity client usage.
- [`contributing.md`](docs/contributing.md) – branching, testing, and review guidelines.

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
