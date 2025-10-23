# Architecture Overview

GrowNext is a multi-product SaaS starter built around a dedicated identity service,
a tenant-aware portal, and product applications that rely on published HTTP contracts
instead of sharing databases. This document summarizes the topology, component
responsibilities, and the patterns that keep boundaries clean.

## Topology

```
Portal (Next.js) ── OAuth/OIDC ──┐
                                 │
Product apps (e.g. Tasks) ───────┼── Identity service (Fastify + Supabase)
                                 │           │
                                 │           ├── PostgreSQL (`@ma/db`)
                                 │           ├── Supabase GoTrue (auth)
                                 │           └── BullMQ queues (Redis)
                                 │
Worker (BullMQ) ◀────── Jobs ────┘
```

- **Identity service (`apps/identity`)** is the control plane for organizations,
  tenants, products, and entitlements. It fronts Supabase GoTrue for user lifecycle,
  implements OAuth2/OIDC + optional SAML service-provider flows, persists
  authorization codes, and exposes admin/internal APIs (`/portal/*`, `/admin/*`,
  `/internal/tasks/*`).
- **Portal (`apps/portal`)** is the customer-facing launcher and admin UI. It renders
  the Launchpad dashboard (stats, notifications, impersonation banners, quick links)
  using `/portal/launcher`, and handles tenant management, profile updates, and SSO
  redirects. Authenticated routes now live under `app/(portal)/layout.tsx`, which
  eliminates the initial render misalignment seen before login refreshes.
- **Admin (`apps/admin`)** is the internal Super Admin console. It consumes the same
  identity APIs to search users, inspect audit trails, trigger impersonation,
  orchestrate bulk jobs, and manage cross-app entitlements for support and
  compliance teams. Access is limited to privileged roles and requires the identity
  service plus worker queues.
- **Product apps** (Tasks is the canonical example) resolve tenancy context via the
  identity service and enforce authorization using the published SDK
  (`@ma/identity-client`). Each product stores its own data in a dedicated Prisma
  schema (`@ma/tasks-db`) and never imports `@ma/db`.
- **Worker (`apps/worker`)** processes identity and product jobs via BullMQ—tenant
  bootstrap tasks, invitation emails, task notifications, impersonation cleanup, and
  bulk job metrics. It requires access to both databases and the Supabase service-role key.

## Request & data flow

| Step | Description |
| --- | --- |
| 1 | Portal/product kicks off `/oauth/authorize` with PKCE parameters. |
| 2 | Identity validates the Supabase session, entitlements, and issues an authorization code persisted in the `AuthorizationCode` table. |
| 3 | Client exchanges the code at `/oauth/token` and receives access + refresh tokens (refresh stored in HttpOnly cookie). |
| 4 | Portal/Admin call aggregation endpoints (e.g., `/portal/launcher`, admin user/bulk-job feeds) to fetch organization stats, notifications, support tooling context, and impersonation state. |
| 5 | Product app calls `/internal/tasks/context` (or its product-specific equivalent) to hydrate tenant/project metadata. |
| 6 | Product verifies bearer tokens with `IdentityTokenValidator` from `@ma/identity-client`. |
| 7 | Identity records audit events and emits queue jobs (`tenant.created`, `entitlement.granted`, etc.). |
| 8 | Worker handles jobs (create onboarding tasks, send invitations) and publishes follow-up metrics. |
| 9 | Product usage emitters send batched payloads to `/internal/billing/usage/events`; identity stores raw events, enqueues `billing-usage` jobs, and workers roll up aggregates consumed by portal/admin billing dashboards. |

Optional SAML flows terminate at `/saml/:slug/acs`; the identity service validates
assertions, links the NameID to an existing user profile, and resumes the OAuth2
exchange so downstream services behave identically.

## Applications & packages

| Component | Responsibility |
| --- | --- |
| `apps/identity` | Fastify service with Supabase integration, admin/internal APIs, JWKS publishing, queue emitters. |
| `apps/portal` | Next.js App Router frontend for authentication, tenant management, Launchpad dashboard, impersonation indicators. |
| `apps/admin` | Super Admin console for support/compliance teams (user search, impersonation, bulk jobs, audit review). |
| `apps/tasks` | Product example with list/board views, per-tenant data isolation, and identity-client integration. |
| `apps/worker` | BullMQ handlers for identity/product jobs and telemetry publishing. |
| `apps/e2e` | Playwright suites that provision orgs, verify Launchpad flows, and exercise portal/product scenarios. |
| `@ma/contracts` | Zod schemas + OpenAPI fragments shared across services/SDKs. |
| `@ma/identity-client` | JWKS cache, token validation helpers, HTTP clients for identity routes. |
| `@ma/db` | Prisma schema for identity data (organizations, tenants, products, entitlements, auth artifacts). Only the identity service imports this package. |
| `@ma/tasks-db` | Prisma schema for product data. |
| `@ma/ui` | Tailwind/shadcn primitives shared by portal/tasks/admin. |
| `@ma/core` | Logging, environment loader, and shared constants/queue names. |

## Boundary rules

- Product apps and workers treat identity as an HTTP API—no direct imports of
  `@ma/db`. Violations are blocked by ESLint.
- Contracts for new payloads must be added to `@ma/contracts` and versioned
  alongside the SDK.
- When a new product app is introduced, follow the checklist in
  `docs/architecture/adding-product-app.md`: define a product slug, add identity
  routes, update Launchpad tiles, seed entitlements, document runbooks, and extend
  Playwright coverage.
- Background jobs should be declared in identity (queue emits) and implemented in
  the worker with clear logging/metrics. Document new queues in the worker runbook.

## Operational touchpoints

- Health endpoints: identity (`/health`, `.well-known/openid-configuration`), portal (`/api/health`), admin (`/health`), tasks (`/api/status`), worker (BullMQ metrics).
- Seeds: `pnpm --filter @ma/db run db:seed` registers the Tasks product + entitlement; rerun after database resets to keep e2e tests green.
- Supabase service-role token: generate a long-lived JWT (see `docs/setup/local-development.md`) and store it in both `SUPABASE_SERVICE_ROLE_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY`.
- Observability: queue latency, Supabase error codes, identity request latency, and authorization failures are the primary SLO inputs. Wire alerts before accepting production traffic.

With these boundaries and workflows in place, GrowNext stays maintainable as you add
more product experiences or scale beyond the starter kit defaults.
