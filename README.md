<div align="center">

# GrowNext Platform

A multi-product SaaS starter kit with a central identity provider, tenant-aware portal, opinionated product scaffolding, and shared TypeScript SDKs.

</div>

## Quickstart

```bash
pnpm install
cp .env .env.local           # adjust secrets
docker compose up supabase -d
pnpm seed                    # run both databases' migrations + seeds
pnpm dev                     # identity, portal, tasks, worker
```

Visit `http://localhost:3200` to create an organization, grant entitlements, and launch the Tasks app.

## Repository Layout

```
apps/
  identity/   Fastify OAuth2/OIDC service (Supabase-backed)
  portal/     Next.js App Router admin UI and SSO launcher
  tasks/      Tenancy-aware product sample (list/board UI)
  worker/     BullMQ processors for identity + product jobs
  e2e/        Playwright suites and fixtures
packages/
  config/     ESLint, Prettier, and TS presets
  contracts/  Zod schemas + OpenAPI fragments (publishable)
  core/       Logging, env loader, shared utilities
  db/         Identity Prisma schema & helpers (identity only)
  tasks-db/   Tasks Prisma schema & helpers
  identity-client/  JWT validator + tenancy helpers (publishable)
  ui/         Tailwind/shadcn component primitives
```

## Essential Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start identity, portal, tasks, and worker in watch mode. Scoped variants (`dev:identity`, `dev:portal`, etc.) are available. |
| `pnpm build` | Build every workspace (use `build:<service>` for scoped builds). |
| `pnpm test` | Run all Vitest suites (`test:<service>` for a single app). |
| `pnpm lint` / `pnpm typecheck` | Repository-wide linting and TypeScript checks. |
| `pnpm seed` | Apply migrations and seed data for both identity and tasks databases. |
| `pnpm --filter @ma/e2e test:<suite>` | Execute Playwright suites (`portal`, `tasks`, `identity`, `smoke`). |

## Documentation

The full documentation set lives in [`docs/`](docs/README.md). Highlights:

- Getting started, deployment, Prisma upgrade, and SDK release guides.
- Architecture overview and platform component reference.
- Runbooks for identity, portal, tasks, and worker services, plus incident/migration playbooks.
- Environment variable and permissions catalogues.
- Automation guardrails and CI workflow overview.

## Testing & CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests for each service, builds the SDKs, and compiles all deployable apps. Reproduce locally with:

```bash
pnpm lint
pnpm typecheck
pnpm test:identity && pnpm test:portal && pnpm test:tasks && pnpm test:worker
pnpm build:identity && pnpm build:portal && pnpm build:tasks && pnpm build:worker
```

## License

MIT — adapt and extend GrowNext for your own SaaS products.
