# Worker Runbook

The worker application processes asynchronous jobs emitted by the identity service and product apps. It uses BullMQ with a shared Redis instance.

## Service Overview

- **Location**: `apps/worker`
- **Entry point**: `src/index.ts`
- **Queues handled**:
  - `identity-events` – organization/tenant lifecycle
  - `user-management-jobs` – invitations, session cleanup
  - `task-notifications` – task assignment, due-soon reminders
  - `super-admin.bulk-job` – privileged bulk operations (activate/suspend/export)
  - `billing-usage` – aggregate raw usage events into rollups
  - `billing-invoice` – generate invoice documents and schedule renewals
  - `billing-payment-sync` – reconcile payment provider webhooks and retries
- **Datastores**: `DATABASE_URL` (identity DB for read-only lookups), `TASKS_DATABASE_URL`, `REDIS_URL`

## Running Locally

```bash
pnpm dev:worker
```

Ensure Redis and both Postgres databases are reachable. The worker relies on Supabase service role access for certain identity operations, so verify `SUPABASE_SERVICE_ROLE_KEY` is set.

## Deployment Considerations

- Scale horizontally when queue latency grows; BullMQ automatically partitions jobs across instances.
- Set `BULLMQ_METRICS_INTERVAL` (if using metrics middleware) to capture queue stats.
- Graceful shutdown waits for in-flight jobs—ensure your orchestrator grants enough termination time.
- New product queues should be documented up-front (see [Adding a Product App](../../architecture/adding-product-app.md)) so SREs know which queue names to watch and how to size Redis.

## Key Environment Variables

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Supabase operations (email, user context) |
| `IDENTITY_BASE_URL` | Identity HTTP API base for fallback HTTP calls |
| `DATABASE_URL`, `TASKS_DATABASE_URL` | Prisma clients when jobs need data access |
| `TASKS_PRODUCT_SLUG` | Used when seeding default entitlements during bootstrap |

See [`../reference/env-vars.md`](../reference/env-vars.md) for the comprehensive list.

## Monitoring

- Track queue lengths, failed job counts, and retry rates (BullMQ UI, Grafana, or custom dashboards).
- Subscribe to the `super-admin.bulk-job.metrics` Redis channel for real-time bulk job telemetry (status, throughput, failure counts).
- Validate the new Tasks background-jobs panel by ensuring `/api/telemetry/metrics` emits assignment latency samples and Grafana (see `TASKS_GRAFANA_DASHBOARD_URL`) reflects queue depth trends.
- Billing workloads monitor the three queues above; alert when `billing-usage` accumulates more than a few hundred events, or when `billing-payment-sync` retries exceed expected thresholds (usually indicates Stripe downtime).
- Alert on Redis connection failures and exponential backoff retries.
- Inspect worker logs for job-level errors; jobs throw exceptions to trigger retries.

## Billing Tooling

- **Usage backfill**: enqueue reconciliation jobs over a historical window with
  ```bash
  pnpm --filter @ma/worker billing:backfill -- --org ORG_ID --subscription SUB_ID --start 2024-08-01 --end 2024-09-01 --resolution daily --features ai.tokens
  ```
  This schedules `billing-usage.backfill` jobs per period and is safe to run idempotently.
- **Load test harness**: stress the billing queues locally with
  ```bash
  pnpm --filter @ma/worker billing:load-test -- --org ORG_ID --subscription SUB_ID --days 3 --usage-jobs 25 --invoices false
  ```
  Set `--invoices true` to enqueue invoice jobs alongside usage rollups. Review worker logs and queue stats during and after the run.
- All CLI tooling requires Redis/database connectivity and the usual billing feature flags enabled.

## Scheduled Tasks

- The worker triggers the impersonation cleanup routine every 24 hours, calling identity to retire expired impersonation tokens and log corresponding audit events. Monitor logs for `Expired impersonation sessions cleaned` entries to confirm execution.

## Troubleshooting

| Issue | Action |
| --- | --- |
| Jobs stuck in `waiting` | Redis unreachable or worker offline—check network/security groups and restart worker. |
| Rapid retries | Review job stack traces, confirm downstream services (identity, tasks) are healthy. |
| Memory growth | Investigate long-running jobs or large payloads; consider streaming large exports to S3 instead of processing in-memory. |
| Duplicate processing | Ensure queue names are unique per job type and dedupe keys are set when necessary. |
| New product jobs missing | Confirm the product’s queue handler was registered and the identity service is enqueuing to the documented queue name. |

Escalate to the platform team if queue failures coincide with identity or portal outages—the worker often experiences secondary symptoms.
