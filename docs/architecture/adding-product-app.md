# Adding a New Product Application

Follow this checklist when introducing another tenant-aware app (beyond **Tasks**) so
identity, portal, and workers stay aligned.

## 1. Define the product contract

1. Choose a unique product slug (`publisher`, `analytics`, etc.) and document it in
   the release plan (`docs/meta/plans/`).
2. Extend `packages/contracts` with any new request/response schemas. Run
   `pnpm --filter @ma/contracts build` to verify the bundle.
3. Update `docs/reference/env-vars.md` if new toggles or URLs are required.

## 2. Extend the identity service

- Add admin APIs in `apps/identity/src/routes/admin/index.ts` for provisioning or
  configuration changes. Guard them with `withAuthorizationTransaction` +
  `buildServiceRoleClaims`.
- Create an internal context route (`apps/identity/src/routes/internal/<product>.ts`)
  modelled after `/internal/tasks/context`. It should resolve organization/tenant
  IDs from Supabase claims, filter entitlements by your product slug, and return any
  metadata the front-end needs.
- Emit background jobs through the shared queues if the product requires
  provisioning or notifications.
- Update documentation (architecture overview, runbooks) once routes are live.

## 3. Wire the worker (optional)

If asynchronous work is needed:

1. Register a handler in `apps/worker/src` for the new queue.
2. Document the queue behaviour and monitoring expectations in
   `docs/operations/runbooks/worker.md`.
3. Ensure failures are visible via structured logs + BullMQ metrics.

## 4. Update the portal launcher

- Include the product in the `/portal/launcher` response with entitlement details
  and launcher URL.
- Render a tile or call-to-action in `LaunchpadDashboard`
  (`apps/portal/components/launchpad-dashboard.tsx`).
- Capture support links or status pages in the Launchpad quick links array.
- Add end-to-end coverage in `apps/e2e/tests/portal` to keep the login → launch loop
  working.

## 5. Build the product surface

- Scaffold the app under `apps/<product>` (Next.js is the canonical pattern).
- Create a dedicated Prisma package if the product owns data (`packages/<product>-db`),
  mirroring `@ma/tasks-db`.
- Fetch tenancy context through the identity route you created, and rely on
  `@ma/identity-client` to validate bearer tokens.
- Publish any reusable SDK helpers (queue names, context fetchers) if other services
  consume them.

## 6. Configuration checklist

- Seed default entitlements if required (`pnpm --filter @ma/db run db:seed` plus a
  product-specific seed).
- Set environment variables for each service (`PRODUCT_SLUG`, base URLs, queue names).
- Update CORS (`API_CORS_ORIGINS`) and Supabase redirect URLs to include the new app.
- Document Grafana, alerting, or telemetry additions in the relevant runbooks.

## 7. Testing & release

- Expand Playwright suites to cover the new product’s critical flows.
- Run `pnpm lint`, `pnpm typecheck`, and service-specific builds before merging.
- Update release plans (`docs/meta/plans/<app>/`) with scope, testing, and rollout
  notes. Bump the package version once the work lands.

By following these steps, every product app remains independently deployable while
sharing the same identity and authorization backbone.
