# Prisma Upgrade Playbook

Use this playbook when bumping Prisma or regenerating clients for the identity
(`@ma/db`) and tasks (`@ma/tasks-db`) packages.

## 1. Plan the upgrade

- Read Prisma release notes for breaking changes (schema syntax, engine updates).
- Audit `package.json` in both packages and the root workspace for version pins.
- Confirm managed Postgres instances support any new features you plan to adopt.

## 2. Update dependencies

```bash
pnpm up prisma @prisma/client --latest --filter @ma/db
pnpm up prisma @prisma/client --latest --filter @ma/tasks-db
```

Update any other workspaces that depend on Prisma (tests, tooling) as needed.

## 3. Regenerate clients

```bash
pnpm --filter @ma/db prisma:generate
pnpm --filter @ma/tasks-db prisma:generate
```

Ensure generated output compiles by running `pnpm build` (or the scoped builds).

## 4. Run migrations

- Apply migrations locally: `pnpm db:migrate` and `pnpm tasks-db:migrate`.
- For staging/production, follow the deployment playbook (`docs/setup/deployment.md`)
  to run migrations during a controlled window or zero-downtime sequence.

## 5. Re-run tests

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ma/e2e run test:portal
```

Address type changes (e.g., enum adjustments), update seeds when defaults shift, and
validate Supabase policies still behave as expected.

## 6. Communicate the change

- Note the upgrade in release plans (`docs/meta/plans/<app>`).
- Notify downstream teams so they can align client versions.
- If breaking, document migration steps in `docs/operations/sdk-release.md` and the SDK changelog.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `PANIC: Prisma Client` at runtime | Regenerate clients with the new engine; verify Node version compatibility. |
| Migration drift warnings | Run `prisma migrate resolve --applied` or clean failed rows in `_prisma_migrations`. |
| Supabase CLI mismatch | Update the Supabase CLI to align with the bundled config. |
