# Database Migration Playbook

This playbook outlines the process for applying Prisma migrations to the identity and tasks databases in staging and production.

## 1. Preparation

1. Review pending migrations in `packages/db/prisma/migrations` and `packages/tasks-db/prisma/migrations`.
2. Confirm migrations have been committed with descriptive names and checked into version control.
3. Ensure backups and point-in-time recovery are enabled for both Postgres instances.

## 2. Dry Run (Local / Staging)

```bash
pnpm db:migrate
pnpm tasks-db:migrate
pnpm test
pnpm --filter @ma/e2e test:tasks
```

- Validate schema changes with application tests.
- Verify Prisma clients were regenerated (`pnpm --filter @ma/db prisma:generate`, `pnpm --filter @ma/tasks-db prisma:generate`).

## 3. Production Execution

1. Put the application into a safe deploy window; notify stakeholders.
2. Run migrations in identity database:

   ```bash
   pnpm db:migrate --env-file .env.production
   ```

3. Run migrations in tasks database:

   ```bash
   pnpm tasks-db:migrate --env-file .env.production
   ```

4. If using Render/Fly, execute the commands via SSH or a one-off job with the correct env group.

## 4. Validation

- Inspect `_prisma_migrations` for errors or lingering `InProgress` entries.
- Run smoke tests (portal login, task creation, worker job processing).
- Monitor logs for Prisma warnings or migration drift.

## 5. Rollback Strategy

- If a migration fails before completion, Prisma marks it as failed. Resolve the issue, rerun the migration, or use `prisma migrate resolve --applied <migration_name>` after manual SQL fixes.
- If data corruption occurs, restore from backups or point-in-time recovery and re-apply migrations once corrected.

## 6. Post-Migration Tasks

- Update relevant runbooks/docs if schema changes require new operational steps.
- Communicate completion to stakeholders.
- Capture lessons learned for future migrations (e.g., indexes to create concurrently, zero-downtime strategies).

Keep this playbook alongside deployment and incident response guides so the on-call team can execute migrations confidently without context switching.
