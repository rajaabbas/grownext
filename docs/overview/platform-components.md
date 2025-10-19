# Platform Components

GrowNext ships as a Turborepo monorepo with a handful of deployable apps and reusable workspace packages. Use this quick reference to understand how everything fits together and which code paths own specific responsibilities.

## Applications

| Path | Description | Notes |
| --- | --- | --- |
| `apps/identity` | Fastify service that fronts Supabase GoTrue, implements OAuth2/OIDC, optional SAML SP flows, and organization/tenant/product admin APIs. | Only service allowed to import `@ma/db`; exposes `/oauth/*`, `/portal/*`, `/internal/tasks/*`, `/saml/*`. |
| `apps/portal` | Next.js App Router frontend that handles authentication, tenant management, permissions, and SSO launch into product apps. | Uses Supabase session cookies + REST calls to the identity service. |
| `apps/tasks` | Product app showcasing tenancy-aware CRUD, list/board UI, and identity-client usage. | Persists data via `@ma/tasks-db` and identity HTTP APIs. |
| `apps/worker` | BullMQ worker processing identity and product jobs (tenant bootstrap, invitation emails, task notifications). | Requires Redis + access to both databases. |
| `apps/e2e` | Playwright test suite with fixtures for provisioning organizations, exercising portal/tasks flows, and validating APIs. | Needs running dev servers; CI runs targeted suites via `pnpm --filter @ma/e2e test:<suite>`. |

## Packages

| Package | Purpose |
| --- | --- |
| `@ma/config` | Centralized ESLint, Prettier, and TypeScript presets consumed by every workspace. |
| `@ma/contracts` | Zod schemas and OpenAPI fragments for shared HTTP contracts. Published as an SDK. |
| `@ma/core` | Environment loader, logging helpers, Supabase gateway utilities, shared constants. |
| `@ma/db` | Prisma schema + helpers for identity data (organizations, tenants, entitlements, auth artifacts). Not to be imported outside `apps/identity`. |
| `@ma/tasks-db` | Prisma schema + helpers for product/task data; consumed by `apps/tasks` and `apps/worker`. |
| `@ma/identity-client` | SDK for fetching tenancy context and validating JWTs (JWKS caching, RBAC helpers). |
| `@ma/ui` | Tailwind/shadcn UI primitives shared across frontends. |

### Cross-Cutting Patterns

- **Supabase integration** lives in `apps/identity/lib/supabase/*` (server-side) and `apps/portal/lib/supabase/*` (client-side). Follow the helpers there instead of instantiating clients manually.
- **HTTP clients** that talk to the identity service reside under `apps/portal/lib/identity` and `apps/tasks/lib/identity`. They lean on contracts defined in `@ma/contracts`.
- **Queues** are defined in `apps/identity/src/queues` and consumed in `apps/worker/src/jobs`. Jobs should avoid direct database access from product apps; fetch what you need through HTTP or the dedicated Prisma package.

## Choosing the Right Place for New Code

| Scenario | Placement |
| --- | --- |
| New organization/tenant/product API | `apps/identity` route + `@ma/db` model changes |
| Portal-only UI change | `apps/portal` components, Tailwind tokens in `@ma/ui` if reusable |
| Shared validation or DTO | `@ma/contracts` (and bump the SDK version) |
| Product-specific schema | `@ma/tasks-db` (or another product package) |
| Reusable logging/env helpers | `@ma/core` |
| Automated job | Queue definition in `apps/identity`, worker handler in `apps/worker` |

Keeping these boundaries enforced prevents accidental coupling and makes it easier to publish SDKs or spin up additional product applications in the future.
