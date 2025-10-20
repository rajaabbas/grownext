# Worker

BullMQ workers that process identity and product jobs (tenant bootstrap,
impersonation cleanup, task notifications, bulk job metrics).

## Run locally

```bash
pnpm dev --filter @ma/worker
```

Requires Redis (`REDIS_URL`) and access to both the identity and tasks databases.

## Docs

- Worker runbook: `docs/operations/runbooks/worker.md`
- Deployment checklist: `docs/setup/deployment.md`
- Automation guardrails: `docs/meta/automation.md`
