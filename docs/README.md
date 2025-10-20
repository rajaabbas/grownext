# GrowNext Documentation Index

Use this index to navigate architecture notes, guides, operational references, and
process documentation.

## Overview & Planning

- [`overview/architecture.md`](overview/architecture.md) – topology, request flows, data model highlights.
- [`overview/platform-components.md`](overview/platform-components.md) – summary of each app and workspace package.
- [`overview/roadmap.md`](overview/roadmap.md) – backlog of future platform enhancements.
- [`plans/`](plans/README.md) – per-app release plans (next version work items, version bump guidance).

## Guides

- [`guides/getting-started.md`](guides/getting-started.md) – local setup, migrations, and developer workflow.
- [`guides/deployment.md`](guides/deployment.md) – production readiness checklist.
- [`guides/sdk-release-guide.md`](guides/sdk-release-guide.md) – publishing `@ma/contracts` and `@ma/identity-client`.
- [`guides/upgrading-prisma.md`](guides/upgrading-prisma.md) – process for bumping Prisma clients safely.

## Operations

- Runbooks: [`identity`](operations/runbooks/identity.md) · [`portal`](operations/runbooks/portal.md) · [`tasks`](operations/runbooks/tasks.md) · [`worker`](operations/runbooks/worker.md)
- Playbooks: [`incident-response`](operations/playbooks/incident-response.md) · [`migrations`](operations/playbooks/migrations.md)

## Reference

- [`reference/env-vars.md`](reference/env-vars.md) – environment variable catalogue.
- [`reference/permissions.md`](reference/permissions.md) – portal permissions and task entitlements.
- [`reference/contracts.md`](reference/contracts.md) – guidelines for shared Zod schemas.

## Meta & Automation

- [`meta/README.md`](meta/README.md) – conventions for process documentation and a meta-doc index.
- [`meta/contributing.md`](meta/contributing.md) – branching strategy, test requirements, and review checklist.
- [`automation/agents.md`](automation/agents.md) – guardrails for automation and AI tooling.
- [`automation/ci.md`](automation/ci.md) – overview of the GitHub Actions pipeline.

> Keep this index and the meta folder updated whenever you add or relocate
> documentation so contributors—human or automated—can find authoritative guidance
> quickly.
