# Billing Rollout – Release Notes (v0.1.3)

## Portal (v0.1.3)
- Added billing overview, usage, invoices, and plan-management surfaces gated behind `PORTAL_BILLING_ENABLED`.
- Integrated identity billing APIs and added plan-change/payment method flows.
- New Playwright coverage for billing navigation, usage filters, plan change, and payment method updates.
- Adopted shared `@ma/ui` billing components for plan summaries, usage tables, and invoices to align theming with design tokens.

## Admin (v0.1.3)
- Delivered billing catalog, subscription oversight, invoice review, credit issuance, and usage explorer pages (`ADMIN_BILLING_ENABLED`).
- Added Tailwind updates and CLI integrations for finance workflows.
- Playwright admin billing suite exercises catalog, usage filters, and invoice table.
- Invoice review refreshed to use shared `@ma/ui` billing components for consistent styling and accessibility.

## Identity (v0.1.3)
- Hardened Stripe payment provider (customer sync, payment method vaulting, webhooks, dispute handling).
- Added ingestion drop monitoring and documentation updates.
- Published super-admin billing APIs plus CLI helpers for credit issuance and subscription management.
- Added identity-client unit tests enforcing Authorization headers across portal/admin billing helpers.

## Worker (v0.1.3)
- Billing usage/invoice/payment-sync processors now idempotent with job dedupe and CLI tooling (`billing:backfill`, `billing:load-test`).
- Added monitoring hooks and documentation for operational handoffs.

## Cross-App
- Usage instrumentation emits structured events from Tasks product.
- Runbooks updated across portal/admin/identity/worker with billing procedures.
- Backfill scripts and load-test harness documented for staging sign-off (full load-test execution deferred to v0.1.4 Tasks Launch Readiness with playbook in epic).
