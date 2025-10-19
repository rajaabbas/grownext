# GrowNext Documentation Index

Use this index to navigate architecture notes, guides, and operational references.

## Overview

- [`overview/architecture.md`](overview/architecture.md) – topology, request flows, data model highlights.
- [`overview/platform-components.md`](overview/platform-components.md) – summary of each app and workspace package.
- [`overview/roadmap.md`](overview/roadmap.md) – backlog of future platform enhancements.

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

## Automation

- [`automation/agents.md`](automation/agents.md) – service boundary guardrails for automation.
- [`automation/ci.md`](automation/ci.md) – overview of the GitHub Actions pipeline.

> Contribution guidelines remain in [`docs/contributing.md`](contributing.md). Update this index whenever you add or relocate documentation so the top-level navigation stays accurate.
