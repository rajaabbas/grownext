# Worker Service

Queue-driven background workers built on BullMQ. Workers consume identity events to perform downstream tasks such as invitation emails, audit fan-out, and product provisioning.

## Responsibilities

- Process BullMQ jobs defined in `packages/contracts`
- React to identity service events (sign-ups, entitlement updates) for asynchronous workloads
- Provide shared job factories and instrumentation utilities

## Local Development

```bash
pnpm dev --filter @ma/worker
```

Redis must be available locally at the `REDIS_URL` configured in `.env` for queue processing.
