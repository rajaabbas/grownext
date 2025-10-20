# Tasks App

Sample tenant-aware product built with Next.js. Demonstrates list/board views,
project permissions, BullMQ notifications, and integration with the identity
service through `@ma/identity-client`.

## Run locally

```bash
pnpm dev --filter @ma/tasks
```

Run the identity service and worker alongside Tasks to exercise auth and queue
flows.

## Docs

- Local setup: `docs/setup/local-development.md`
- Tasks runbook: `docs/operations/runbooks/tasks.md`
- Adding new products: `docs/architecture/adding-product-app.md`
