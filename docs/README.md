# GrowNext Documentation Index

The docs are organized by task: start with setup, dive into architecture, reference
runbooks for day-to-day operations, and consult meta guides for process decisions.

## Setup

- [`setup/local-development.md`](setup/local-development.md) – install dependencies, configure Supabase credentials, seed databases, and run tests locally.
- [`setup/deployment.md`](setup/deployment.md) – production readiness checklist covering secrets, migrations, validation, and maintenance.
- [`setup/onboarding.md`](setup/onboarding.md) – tenant onboarding checklist aligned with v0.2.0 guardrails.

## Architecture

- [`architecture/overview.md`](architecture/overview.md) – topology, component responsibilities, request flow, and boundary rules.
- [`architecture/adding-product-app.md`](architecture/adding-product-app.md) – step-by-step checklist for introducing another tenant-aware product.

## Operations

- Runbooks: [`identity`](operations/runbooks/identity.md) · [`portal`](operations/runbooks/portal.md) · [`admin`](operations/runbooks/admin.md) · [`tasks`](operations/runbooks/tasks.md) · [`worker`](operations/runbooks/worker.md)
- Playbooks: [`incident-response`](operations/playbooks/incident-response.md) · [`migrations`](operations/playbooks/migrations.md)
- Guides: [`sdk-release.md`](operations/sdk-release.md) · [`prisma-upgrade.md`](operations/prisma-upgrade.md)

## Reference

- [`reference/env-vars.md`](reference/env-vars.md) – environment variable catalogue.
- [`reference/permissions.md`](reference/permissions.md) – portal permissions and task entitlements.
- [`reference/contracts.md`](reference/contracts.md) – shared Zod schema guidance.
- [`reference/security-faq.md`](reference/security-faq.md) – hardening FAQ for tenant guardrails, token lifecycle, and impersonation safety.

## Meta

- [`meta/README.md`](meta/README.md) – entry point for process docs.
- [`meta/contributing.md`](meta/contributing.md) – branching strategy, required checks, review checklist.
- [`meta/automation.md`](meta/automation.md) – automation guardrails, CI expectations, release-plan coordination.
- [`meta/plans/`](meta/plans/README.md) – per-app release plans and next-version scope.
- [`meta/roadmap.md`](meta/roadmap.md) – longer-term platform initiatives.

Keep this index current whenever documentation moves or new guides are added.
