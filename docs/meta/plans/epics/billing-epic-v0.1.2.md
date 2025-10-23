# Billing Enablement Epic (v0.1.2)

This epic captures the first release of billing surfaces across the platform (Portal/Admin/Identity/Worker v0.1.2). All work in this epic has shipped and laid the groundwork for the follow-up v0.1.3 hardening effort.

> **Status:** ✅ Delivered (Mar 2024)

## Linked Plans
- Portal billing v0.1.2 – `docs/meta/plans/portal/v0.1.2.md`
- Identity billing foundations v0.1.2 – `docs/meta/plans/identity/v0.1.2.md`
- Admin billing console v0.1.2 – `docs/meta/plans/admin/v0.1.2.md`
- Worker billing processors v0.1.2 – `docs/meta/plans/worker/v0.1.2.md`

## Highlights
- Introduced portal billing navigation, overview, usage, plan-management, and invoices pages gated by `PORTAL_BILLING_ENABLED`.
- Delivered identity billing schema, APIs, and Stripe integration backing portal/admin experiences.
- Launched admin finance tooling (catalog, subscriptions, invoices, credits, usage explorer).
- Shipped worker billing queues for usage aggregation, invoice generation, and payment sync.

## Completed Workstreams
- [x] Shared packages – contracts, database schema/migrations, identity-client helpers.
- [x] Portal billing module (overview, usage, plan changes, invoices, observability).
- [x] Identity billing APIs + domain services.
- [x] Admin finance console.
- [x] Worker billing processors and telemetry.
- [x] Runbooks + architecture updates covering billing flows.

## Rollout Notes
- Feature flags remained disabled until usage backfills were complete per tenant.
- Stripe configuration and secret management documented for operations.
- Release notes archived under `docs/meta/releases/` for the v0.1.2 train.
