# Adding a New Product Application

This guide captures the end-to-end steps for introducing another tenant-aware app (similar to **Tasks**) into the GrowNext platform. Follow it when building new marketing products so every service hooks into identity, admin, and portal consistently.

## 1. Plan the Product Slug & Contracts

1. Pick a unique product slug (e.g. `publisher`), record it in product specs, and add it to `@ma/contracts` so the slug is discoverable by other services.
2. Extend `packages/contracts` with any new request/response schemas the product will expose. Regenerate the TypeScript output (`pnpm --filter @ma/contracts typecheck`) to verify the bundle.

💡 *Treat contracts as the shared language between identity, admin, portal, and the new app. Avoid leaking Prisma types across service boundaries.*

## 2. Identity Service Integration

Identity acts as the control plane for every product experience.

- **Admin APIs**: Update `apps/identity/src/routes/admin/index.ts` with CRUD endpoints if your product needs new lifecycle hooks (e.g. default policies, provisioning jobs). Use `withAuthorizationTransaction` and `buildServiceRoleClaims` to guard multi-tenant access.
- **Internal context route**: Create a new router under `apps/identity/src/routes/internal/<product>` that returns the product’s tenancy context (mirroring `internal/tasks`). It should:
  - Resolve organization/tenant IDs from Supabase claims.
  - Filter entitlements by your product slug.
  - Hydrate any product-specific metadata the front-end needs (e.g. project summaries, configuration flags).
- **Queues**: If background work is required, register jobs via `createIdentityQueues()` and process them in the worker. Stick to one queue per concern to make monitoring easier.
- **Security**: Update [the env reference](../reference/env-vars.md) if you add new toggles, and verify rate limiting and CORS settings cover the new front-end origin.

## 3. Worker Follow-Up (Optional)

If the product requires asynchronous provisioning or notifications:

1. Add a job handler in `apps/worker/src` that listens to the relevant BullMQ queue.
2. Document the queue in [`docs/operations/runbooks/worker.md`](../operations/runbooks/worker.md) so ops understands scaling requirements.
3. Ensure failures surface clearly (structured logs + BullMQ metrics).

## 4. Admin Console Updates

The admin app enables and configures products for organizations:

- Add UI toggles or forms under `apps/admin/components` that call the new identity admin endpoints.
- Update feature-flag guidance in `apps/admin/components/settings` if your product introduces new switches.
- Expand E2E coverage (`apps/e2e/tests/admin`) to walk through enrollment, permission edits, and bulk operations related to your product.

## 5. Portal Launcher Integration

Portal exposes the “app loop” for customers:

1. Have identity return the new product (with entitlements and status) in `/portal/launcher`.
2. Render a tile or action in `LaunchpadDashboard` (`apps/portal/components/launchpad-dashboard.tsx`) pointing to your product’s base URL.
3. Update the portal runbook with any status endpoints or dashboards associated with the product.

## 6. Build the Product App

Use **Tasks** (`apps/tasks`) as the template:

- Scaffold a Next.js (or preferred) web app under `apps/<product>`.
- Keep product data in its own Prisma schema (copy the `packages/tasks-db` pattern) so ownership is clear.
- Fetch tenancy context via the identity internal endpoint you created and guard UI affordances based on entitlements.
- Publish helper SDKs (e.g. `@ma/<product>-db`) in `packages/` if the worker or other services need typed access.

## 7. Configuration Checklist

Before shipping to staging or production:

- Add the product slug to seed scripts / migrations if default entitlements are required.
- Set environment variables for every service that references the product (`PRODUCT_SLUG`, queue names, base URLs).
- Confirm `API_CORS_ORIGINS` includes the new front-end domain, and disable `E2E_BYPASS_RATE_LIMIT` outside of CI.
- Document any new Grafana/Loki dashboards in the relevant runbooks.

## 8. Testing & Release

- Extend the Playwright suites under `apps/e2e/tests` to cover the new product’s critical flows (auth, provisioning, key interactions).
- Run `pnpm lint`, `pnpm typecheck`, and the per-app builds to ensure pipelines remain green.
- Update the change log or release notes so downstream teams know the product is available.

## 9. Documentation Touchpoints

Finally, update or create docs so the rest of the organization can operate the new app:

- Add a product section to `docs/operations/runbooks/`.
- Reference the product in architecture/overview diagrams.
- Note required env vars in [`docs/reference/env-vars.md`](../reference/env-vars.md).
- Link the new runbooks from onboarding checklists.

Following these steps keeps the monorepo ready for additional apps without sacrificing security or maintainability. If a future product needs behavior outside this template, capture the deviations directly in documentation so they don’t become tribal knowledge.
