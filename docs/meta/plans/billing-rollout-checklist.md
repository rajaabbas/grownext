# Billing Integration Delivery Checklist

This checklist aligns the cross-app billing initiative (Portal/Admin/Identity/Worker v0.1.2) with the shared packages and feature flag strategy.  
It assumes end-to-end ownership with no external handoffs.

> **Current status (Apr 2024):** Contracts/DB/identity-client foundations are live, identity worker processors are operational, and portal billing surfaces (overview, usage, invoices, plan management) are in active QA behind `PORTAL_BILLING_ENABLED`. Remaining focus areas: admin console tooling, product usage emitters, payment provider hooks, and ops/runbook documentation.

See `docs/meta/plans/billing/v0.1.3.md` for the follow-up implementation plan that closes these remaining gaps.

## Shared Package Updates
- **`@ma/contracts`**
  - [x] Add billing schemas (`billing/packages.ts`, `billing/subscriptions.ts`, `billing/usage.ts`, `billing/invoices.ts`).
  - [x] Export new types through `index.ts` and update contract tests (`contracts.test.ts`) with fixtures covering happy/error paths.
- **`@ma/db`**
  - [x] Extend Prisma schema with billing entities: `BillingPackage`, `BillingFeatureLimit`, `Subscription`, `SubscriptionSchedule`, `UsageEvent`, `UsageAggregate`, `Invoice`, `InvoiceLine`, `PaymentMethod`, `CreditMemo`.
  - [x] Generate migrations, update type-safe helpers under `src/billing/*`, and wire transactional utilities for read/write isolation.
  - [x] Refresh seed data (`prisma/seed.ts`) so local environments ship with demo packages, invoices, and sample usage aggregates.
- **`@ma/identity-client`**
  - [x] Implement helper methods for portal/admin flows: billing overview, usage, subscription changes, invoice fetch/pay, package CRUD, credit issuance.
  - [ ] Ensure token-scoped headers/enforcement and add unit tests (`http.test.ts`) for new routes.
- **`@ma/core`**
  - [x] Extend queue constants (`src/queues.ts`) with `BILLING_USAGE`, `BILLING_INVOICE`, `BILLING_PAYMENT_SYNC`.
  - [x] Add env var definitions in `src/env.ts` for billing feature flags and payment provider secrets (e.g., `IDENTITY_BILLING_ENABLED`, `PORTAL_BILLING_ENABLED`, processor keys).
- **`@ma/ui`**
  - [ ] Contribute shared components for billing visuals: stacked stat cards, usage charts, invoice tables.
  - [ ] Verify theming aligns with existing Tailwind preset; include story/test coverage if applicable.
- **`@ma/core` docs & scripts**
  - [ ] Document new env vars in `docs/reference/env-vars.md`.
  - [ ] Update scripts or tooling as needed (e.g., add seed helpers or backfill commands under `scripts/`).

## Feature Flags & Configuration
- `IDENTITY_BILLING_ENABLED`: guards new identity routes & usage ingestion; default false in production.
- `PORTAL_BILLING_ENABLED`: toggles portal billing navigation and API proxy endpoints.
- `ADMIN_BILLING_ENABLED`: hides admin billing section until data is ready.
- `WORKER_BILLING_ENABLED`: controls worker queue registration.
- `IDENTITY_PAYMENT_PROVIDER` + provider-specific secrets (e.g., `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`).
- Ensure flags exist in `packages/core/src/env.ts`, are surfaced to relevant apps via Next.js public envs where required, and documented in ops runbooks.

## Engineering Task Breakdown
1. **Foundations**
   - [x] Finalize Prisma schema + migrations; run `pnpm --filter @ma/db db:migrate` locally.
   - [x] Implement contract+client updates and regenerate types (`pnpm turbo run build --filter ...`).
   - [x] Add seed data and fixture generators for tests.
2. **Identity Service**
   - [x] Build billing domain modules (`apps/identity/src/lib/billing/*`) covering package catalog, subscription lifecycle, usage storage, rating, invoices, payments.
   - [x] Implement Fastify routes (`/portal/billing/*`, `/super-admin/billing/*`, `/internal/billing/*`) with authz, rate limiting, and audit logging.
   - [ ] Integrate payment provider plugin and webhook handlers; update runbooks.
3. **Worker Jobs**
   - [x] Create processors for usage aggregation, invoice generation, payment sync; register queues and scheduling logic.
   - [ ] Add CLI helpers for manual triggers and backfills.
   - [ ] Instrument metrics and ensure retries/idempotency.
4. **Portal UI**
   - [x] Add billing navigation + layout guard (permission + feature flag).
   - [x] Build pages for overview, usage analytics, plan management, invoices, billing profile.
   - [x] Wire API route proxies (`apps/portal/app/api/billing/*`) and integrate telemetry.
5. **Admin Console**
   - [ ] Extend navigation and role guards.
   - [ ] Deliver package catalog editor, subscription inspector, invoice operations, usage explorer, and support-side billing context.
6. **Product Instrumentation**
   - [ ] Emit usage events from Tasks/other AI workloads (middleware or explicit hooks) to identity ingestion endpoint; include tenant/product metadata.
   - [ ] Backfill existing usage for testing; add throttling/batching for high-volume signals.
7. **Testing & QA**
   - [x] Unit/integration coverage for contracts, identity routes, worker processors, and React components.
   - [ ] End-to-end Playwright suites across portal/admin verifying billing flows and permission boundaries.
   - [ ] Load test usage ingestion and invoice processing with synthetic data.
8. **Ops & Documentation**
   - [ ] Update relevant runbooks (`docs/operations/runbooks/*.md`) and architecture overview with billing flow diagrams.
   - [ ] Prepare rollout checklist (env vars, migrations, feature flag toggles, backfill commands).
   - [ ] Draft release notes for each app version bump (portal/admin/identity/worker 0.1.2).

## Rollout Sequence
1. Deploy schema, contracts, and feature flags (disabled) to non-production.
2. Enable worker billing queues in staging; run synthetic load tests + invoice dry run.
3. Turn on identity billing APIs in staging; validate portal/admin flows end-to-end.
4. Backfill historical usage/invoices if needed; obtain greenlights from automated tests.
5. Promote to production with flags off; toggle cohorts sequentially (internal tenants → beta customers → general availability).

## Verification Checklist
- [ ] All migrations applied in staging and validated against anonymized prod snapshot.
- [ ] Contract clients synced across portal/admin/identity/worker builds.
- [ ] Feature flags default to off and are controllable via env overrides.
- [ ] Usage ingestion and invoice processors proven idempotent under retry.
- [ ] Portal/admin UI respects permissions (`organization:billing`, admin finance roles).
- [ ] Runbooks updated and linked from relevant UI help panels.
- [ ] Release notes drafted for each app/package.
