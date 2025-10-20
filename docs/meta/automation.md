# Automation & CI Guardrails

Automation (Codex agents, CI pipelines, scheduled jobs) must respect the same
boundaries we enforce for human contributors. Keep these rules in mind when adding
scripts, bots, or workflow steps.

## Service boundaries for automation

- Only the identity service (`apps/identity`) may import `@ma/db`. Product apps,
  workers, and automation jobs must call HTTP endpoints and rely on published
  contracts.
- Federation (SAML) terminates at the identity service (`/saml/:slug/acs`); never
  route automation directly to external IdPs or bypass the identity APIs.
- Tasks data lives in `@ma/tasks-db`. If automation needs identity metadata (names,
  roles, entitlements), use `/internal/tasks/context` or other internal identity
  routes—never join across databases.
- When new cross-service behaviour is required:
  1. Design or extend an identity API route.
  2. Update `@ma/identity-client` so downstream services have typed helpers.
  3. Consume the helper from the product/automation code.

Keep documentation (`docs/architecture/overview.md`, runbooks) in sync whenever the
boundary shifts.

## Continuous integration expectations

The CI workflow (`.github/workflows/ci.yml`) executes the following on every push and
pull request:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. Build publishable SDKs: `pnpm --filter @ma/contracts build`,
   `pnpm --filter @ma/identity-client build`
5. Run unit tests: `pnpm test:identity`, `pnpm test:portal`, `pnpm test:admin`,
   `pnpm test:tasks`, `pnpm test:worker`
6. Build deployable apps: `pnpm build:identity`, `pnpm build:portal`,
   `pnpm build:admin`, `pnpm build:tasks`, `pnpm build:worker`

Reproduce locally before opening a PR:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm --filter @ma/contracts build
pnpm --filter @ma/identity-client build
pnpm test:identity && pnpm test:portal && pnpm test:admin && pnpm test:tasks && pnpm test:worker
pnpm build:identity && pnpm build:portal && pnpm build:admin && pnpm build:tasks && pnpm build:worker
```

## Release coordination

- Consult the release plan for the impacted app under `docs/meta/plans/<app>` before
  bumping versions or shipping automation changes.
- Update the plan with scope/test notes while implementing features; create the next
  plan immediately after publishing.
- Keep lockfiles current so `--frozen-lockfile` succeeds both locally and in CI.

Following these guardrails keeps automation aligned with architectural boundaries
and prevents accidental coupling across services.
