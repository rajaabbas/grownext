# Billing Integration Delivery Checklist

This checklist aligns the cross-app billing initiative (Portal/Admin/Identity/Worker v0.1.2) with the shared packages and feature flag strategy.  
It assumes end-to-end ownership with no external handoffs.

> **Current status (Apr 2024):** Contracts/DB/identity-client foundations are live, identity worker processors are operational, and portal billing surfaces (overview, usage, invoices, plan management) are in active QA behind `PORTAL_BILLING_ENABLED`. Remaining focus areas: admin console tooling, product usage emitters, payment provider hooks, and ops/runbook documentation.

Refer to the per-application plans for implementation details:

- Portal: `docs/meta/plans/portal/v0.1.3.md`
- Identity: `docs/meta/plans/identity/v0.1.3.md`
- Worker: `docs/meta/plans/worker/v0.1.3.md`
- Admin: `docs/meta/plans/admin/v0.1.3.md`

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
  - [x] Ensure token-scoped headers/enforcement and add unit tests (`http*.test.ts`) for new routes.
- **`@ma/core`**
  - [x] Extend queue constants (`src/queues.ts`) with `BILLING_USAGE`, `BILLING_INVOICE`, `BILLING_PAYMENT_SYNC`.
  - [x] Add env var definitions in `src/env.ts` for billing feature flags and payment provider secrets (e.g., `IDENTITY_BILLING_ENABLED`, `PORTAL_BILLING_ENABLED`, processor keys).
- **`@ma/ui`**
  - [x] Contribute shared components for billing visuals: stacked stat cards, usage charts, invoice tables.
  - [x] Verify theming aligns with existing Tailwind preset; include story/test coverage if applicable.
- **`@ma/core` docs & scripts**
  - [x] Document new env vars in `docs/reference/env-vars.md`.
  - [x] Update scripts or tooling as needed (e.g., add seed helpers or backfill commands under `scripts/`); no additional automation required beyond documented load-test playbook.

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
   - [x] Integrate payment provider plugin and webhook handlers; update runbooks.
3. **Worker Jobs**
   - [x] Create processors for usage aggregation, invoice generation, payment sync; register queues and scheduling logic.
   - [x] Add CLI helpers for manual triggers and backfills.
   - [x] Instrument metrics and ensure retries/idempotency.
4. **Portal UI**
   - [x] Add billing navigation + layout guard (permission + feature flag).
   - [x] Build pages for overview, usage analytics, plan management, invoices, billing profile.
   - [x] Wire API route proxies (`apps/portal/app/api/billing/*`) and integrate telemetry.
5. **Admin Console**
   - [x] Extend navigation and role guards.
   - [x] Deliver package catalog editor, subscription inspector, invoice operations, usage explorer, and support-side billing context.
6. **Product Instrumentation**
   - [x] Emit usage events from Tasks/other AI workloads (middleware or explicit hooks) to identity ingestion endpoint; include tenant/product metadata.
   - [x] Backfill existing usage for testing; add throttling/batching for high-volume signals.
7. **Testing & QA**
   - [x] Unit/integration coverage for contracts, identity routes, worker processors, and React components.
   - [x] End-to-end Playwright suites across portal/admin verifying billing flows and permission boundaries.
   - [ ] Deferred to Tasks Launch Readiness (v0.1.4): run billing load-test harness and archive results for ingestion/invoice pipelines.
8. **Ops & Documentation**
  - [x] Update relevant runbooks (`docs/operations/runbooks/*.md`) and architecture overview with billing flow diagrams.
  - [x] Prepare rollout checklist (env vars, migrations, feature flag toggles, backfill commands).
  - [x] Draft release notes for each app version bump (portal/admin/identity/worker 0.1.2). See `docs/meta/releases/billing-v0.1.3.md`.

## Rollout Checklist

| Step | Owner | Notes |
| --- | --- | --- |
| Export env vars | Platform | Ensure `IDENTITY_PAYMENT_PROVIDER_*`, `PORTAL_BILLING_ENABLED`, `ADMIN_BILLING_ENABLED`, `WORKER_BILLING_ENABLED` are present in production secrets. |
| Apply latest migrations | Platform | Run `pnpm --filter @ma/db db:migrate` and verify staging/prod schema versions match. |
| Deploy updated services | Platform | Identity, worker, portal, and admin must ship together so queue/event contracts stay aligned. |
| Toggle feature flags | Platform | Enable billing flags per cohort; leave disabled until backfill completes. |
| Backfill usage | Platform | Run `pnpm --filter @ma/worker billing:backfill -- --org <ID> --subscription <ID> --start <ISO> --end <ISO>` for each tenant that needs historical usage. |
| Verify ingestion | Platform | Monitor identity logs for `billing_usage_event_drop` warnings and worker queue depth (`billing-usage`, `billing-payment-sync`). |
| Execute load test (deferred) | Platform | Move to v0.1.4 Tasks Launch Readiness: `pnpm --filter @ma/worker billing:load-test -- --org <ID> --subscription <ID> --days 3 --usage-jobs 25`. Capture throughput + saturation metrics. |

## Rollout Sequence
1. Deploy schema, contracts, and feature flags (disabled) to non-production.
2. Enable worker billing queues in staging; optional synthetic load tests deferred to v0.1.4 unless blocking defects arise.
3. Turn on identity billing APIs in staging; validate portal/admin flows end-to-end.
4. Backfill historical usage/invoices if needed; obtain greenlights from automated tests.
5. Promote to production with flags off; toggle cohorts sequentially (internal tenants → beta customers → general availability).

## Verification Checklist
- [x] All migrations applied in staging and validated against anonymized prod snapshot.
- [x] Contract clients synced across portal/admin/identity/worker builds.
- [x] Feature flags default to off and are controllable via env overrides.
- [x] Usage ingestion and invoice processors proven idempotent under retry.
- [x] Portal/admin UI respects permissions (`organization:billing`, admin finance roles).
- [x] Runbooks updated and linked from relevant UI help panels.
- [x] Release notes drafted for each app/package (see `docs/meta/releases/billing-v0.1.3.md`).

## Load Test Playbook (Deferred)
- **Objective:** Validate billing ingestion + invoicing throughput prior to broad rollout. Deferred to the Tasks Launch Readiness epic (v0.1.4) unless blocking regressions surface earlier.
- **Harness:** `pnpm --filter @ma/worker billing:load-test -- --org <ID> --subscription <ID> --days 3 --usage-jobs 25 --concurrency 5`.
- **Prerequisites:** staging org with billing flags enabled, seeded payment method, worker queues active, telemetry dashboards bookmarked (`billing.usage.processed`, `billing.invoice.processed`).
- **Execution Notes:**
  - Capture queue depth/latency snapshots at start, mid-run, and completion.
  - Export identity + worker logs tagged `billing_load_test` for archive.
  - Record Stripe dashboard metrics (payments + webhooks) if sandbox available.
- **Results Placeholder:** _TBD (to be appended in v0.1.4 once the harness run completes)._
