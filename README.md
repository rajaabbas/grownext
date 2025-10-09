# GROWNEXT

Production-grade, domain-neutral starter for SaaS apps. The workspace ships with multi-tenant user management (organizations, invitations, profiles), a Next.js web client, Fastify API, BullMQ worker scaffold, Prisma + Supabase database access, and a shared tooling stack powered by Turborepo + pnpm.

## Tech Stack
- **Language**: TypeScript (`strict`)
- **Monorepo**: Turborepo orchestrating builds/tests across workspaces
- **Frontend**: Next.js (App Router), Tailwind CSS, shadcn/radix components via `@ma/ui`
- **Backend API**: Fastify + shared Zod contracts in `@ma/contracts`
- **Database**: Prisma targeting Supabase/Postgres with row-level security helpers
- **Auth**: Supabase Auth (email/password with organization provisioning, MFA support)
- **Queues**: BullMQ-backed worker scaffold (Redis)
- **Tooling**: pnpm, ESLint, Prettier, Vitest, GitHub Actions CI

## Workspace Layout
- `apps/web` — Next.js application with auth flows, org management UI, MFA/session helpers
- `apps/api` — Fastify API exposing auth, profile, and organization endpoints
- `apps/worker` — BullMQ worker scaffold plus enqueue script
- `packages/*` — shared configuration, core utilities, contracts, Prisma layer, UI components

## Prerequisites
- Node.js ≥ 18.18 (20.x recommended)
- pnpm 8.x
- Supabase project (URL, anon key, service role key)
- Docker Compose v2 (optional) for local Postgres + Redis

## Environment Configuration
1. Copy the root template and fill secrets:  
   ```bash
   cp .env.example .env
   ```
   Populate Supabase keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `DATABASE_URL`, `REDIS_URL`, and set `APP_BASE_URL` to your public web origin.
2. Copy the web client template:  
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```
   Provide the publishable Supabase keys exposed to the browser (`NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_API_BASE_URL`).
3. Prisma commands executed from `packages/db` require a local env file:  
   ```bash
   cp packages/db/.env.example packages/db/.env
   ```
   Set `DATABASE_URL` to the Postgres instance you will migrate against.
4. Configure SMTP credentials in Supabase (Settings → Auth → SMTP) before running in production so verification and recovery emails are delivered.
5. Review API security settings. By default the API only trusts requests from `APP_BASE_URL` and ignores proxy headers. When running behind a trusted proxy or exposing the API to additional origins, set:
   - `API_CORS_ORIGINS` — optional comma-separated list of additional origins that may call the API with credentials.
   - `TRUST_PROXY=true` — only when your deployment sits behind a load balancer / reverse proxy that forwards the original client IP.

> **Do not commit populated `.env` files.** Only the `*.example` templates are tracked.

## Database Setup
- Start local dependencies (optional if you point at hosted services):  
  ```bash
  docker compose up -d   # Postgres on :54322, Redis on :6379
  ```
- Apply migrations (includes invitation token hashing & audit fields):  
  ```bash
  pnpm db:migrate      # deploys migrations using packages/db/.env
  ```
  For a new database, `pnpm db:push` is also available.
- Supabase CLI users can run `npx supabase start` to boot the full local stack (requires Docker) and `npx supabase stop` to tear it down.

## Running Locally
```bash
pnpm install
pnpm dev              # runs web, api, and worker via Turbo
```
Each app exposes its own dev server:
- Web: http://localhost:3000
- API: http://localhost:3001
- Worker: runs queue processors only (no HTTP endpoint by default)

## Common Commands
### Workspace
- `pnpm install` – install dependencies across the monorepo
- `pnpm dev` – start web, API, and worker in watch mode
- `pnpm build` – produce production builds for every app
- `pnpm test` – execute Vitest-based unit/integration suites (Playwright e2e excluded)
- `pnpm lint` – run ESLint with monorepo rules
- `pnpm typecheck` – run strict TypeScript checks

### Database & Supabase
- `docker compose up -d` – launch Postgres and Redis locally
- `pnpm db:migrate` – apply migrations using `packages/db/.env`
- `pnpm db:push` – sync Prisma schema to the database
- `pnpm db:seed` – seed default data into the database
- `npx supabase start` / `npx supabase stop` – manage the Supabase local stack (Docker required)

### Playwright
- `pnpm --filter @ma/e2e exec playwright install` – download browser binaries (rerun after cache wipes)
- `pnpm e2e:test` – run headless Playwright suites against the app
- `pnpm e2e:test:debug` – open the Playwright inspector for step-through debugging
- `pnpm e2e:test:ui` – use Playwright’s UI mode to watch and rerun scenarios
- `pnpm e2e:codegen` – record user flows and generate Playwright scripts
- `E2E_BASE_URL=http://localhost:3000 pnpm e2e:test` – point tests at a custom server URL
- Provide `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_ROLE_KEY` so Playwright fixtures can toggle email verification metadata when required (tests skip gracefully if absent)
- Set `E2E_BYPASS_RATE_LIMIT=true` in your `.env` while running e2e suites to disable API signup rate limiting locally

## Testing & Quality
- Vitest handles unit/integration coverage across packages and apps.
- ESLint, TypeScript, and Prettier guard code consistency and safety.
- Playwright covers browser journeys; the inspector and UI runner help debug flaky scenarios.
- Generated traces, screenshots, and videos live under `playwright-report/` after failing runs.

## User Management Workflows
- **Email verification-first signup**: `/auth/signup` provisions an owner + organization, returns a `pending_verification` payload, and triggers Supabase to send the email.
- **Invitation acceptance**: `/auth/invitations/:token/accept` now stores SHA-256 token hashes, records issuer/acceptor IPs, and also ends in `pending_verification`.
- **Password reset**: `/auth/password/reset` starts the recovery flow; `/auth/reset-password/confirm` lets users choose a new password after following the mailed link.
- **Session & MFA management**: The profile page surfaces TOTP enrollment (requires Supabase MFA to be enabled) and a button to sign out other sessions.

## Operations Checklist
- **Migrations**: Always run `pnpm db:migrate` after pulling changes so new migrations (e.g., invitation hashing) are applied everywhere.
- **SMTP & email**: Configure Supabase SMTP or plug in your mailer via the worker to deliver verification/invite/reset emails.
- **Rate limiting**: Global max is 200 req/min per IP (`apps/api/src/server.ts`) with stricter caps on auth endpoints (`/auth/signup`, `/auth/invitations/:token/accept`, `/auth/password/reset`). Tune these for your traffic profile.
- **API security defaults**: The API sends credentialed responses only to `APP_BASE_URL` unless you opt in via `API_CORS_ORIGINS`, and it ignores proxy headers unless `TRUST_PROXY=true`. Configure these per environment and keep the defaults in development for defense in depth.
- **Logging**: Sensitive headers/tokens are stripped; wire Pino logs to your preferred sink and confirm no secrets leak.
- **Testing**: Extend the Vitest suites with integration coverage for organization role changes, MFA toggles, and custom flows as you build on the boilerplate.
- **Access control**: Owner-only actions (role promotion, removing owners) are enforced server-side and mirrored in the UI to prevent orphaned organizations.
