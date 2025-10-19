# Upgrading Prisma

This guide captures the steps we follow when bumping Prisma or regenerating clients for the identity (`@ma/db`) and tasks (`@ma/tasks-db`) packages.

## 1. Plan the Upgrade

- Review Prisma release notes for breaking changes (schema syntax, CLI flags, engine updates).
- Audit `package.json` in both packages and the root workspace for version pinning.
- Confirm managed Postgres instances support any new features you plan to use.

## 2. Update Dependencies

```bash
pnpm up prisma @prisma/client --latest --filter @ma/db
pnpm up prisma @prisma/client --latest --filter @ma/tasks-db
```

If other workspaces depend on Prisma (e.g., test tooling), update them as well.

## 3. Regenerate Clients

```bash
pnpm --filter @ma/db prisma:generate
pnpm --filter @ma/tasks-db prisma:generate
```

Check `node_modules/.pnpm/@prisma+client*/` into `.gitignore` and ensure the generated `dist/` output still compiles via `pnpm build`.

## 4. Run Migrations

- Apply migrations locally (`pnpm db:migrate`, `pnpm tasks-db:migrate`) and validate the SQL.
- For production/staging, follow the deployment playbook to run migrations in a maintenance window or zero-downtime sequence.

## 5. Re-run Tests

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ma/e2e test:identity
pnpm --filter @ma/e2e test:tasks
```

Resolve any type changes (e.g., new Prisma enum output), adjust seeds if defaults moved, and verify Supabase policies still align.

## 6. Communicate the Upgrade

- Mention the bump in the main changelog or release notes.
- Notify downstream teams so they can align their client versions.
- If the upgrade is breaking, publish migration notes in the SDK changelog and update relevant docs.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `PANIC: Prisma Client` during runtime | Regenerate clients, ensure Node version satisfies new engine requirements. |
| Migration drift warnings | Re-run `prisma migrate resolve --applied` for historical migrations or delete failed entries from `_prisma_migrations`. |
| Supabase CLI mismatch | Update Supabase CLI to latest so generated policies/hooks stay compatible. |

Document any platform-specific surprises in this file so future upgrades are smoother.
