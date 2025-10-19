# Continuous Integration Guide

The CI pipeline (defined in `.github/workflows/ci.yml`) validates every push to `main` and each pull request. Use this guide to understand what the workflow enforces and how to reproduce it locally.

## Workflow Summary

Steps executed on `ubuntu-latest`:

1. Checkout repository.
2. Install pnpm 8 and Node.js 20 with pnpm cache enabled.
3. `pnpm install --frozen-lockfile`
4. `pnpm lint`
5. `pnpm typecheck`
6. Build publishable SDKs: `pnpm --filter @ma/contracts build`, `pnpm --filter @ma/identity-client build`
7. Run unit tests: `pnpm test:identity`, `pnpm test:portal`, `pnpm test:tasks`, `pnpm test:worker`
8. Build deployable apps: `pnpm build:identity`, `pnpm build:portal`, `pnpm build:tasks`, `pnpm build:worker`

## Local Reproduction

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm --filter @ma/contracts build
pnpm --filter @ma/identity-client build
pnpm test:identity && pnpm test:portal && pnpm test:tasks && pnpm test:worker
pnpm build:identity && pnpm build:portal && pnpm build:tasks && pnpm build:worker
```

Run the commands above before opening a pull request to catch issues early.

## Best Practices

- Keep lockfiles up to date so `--frozen-lockfile` succeeds.
- When adding new workspaces or scripts, update the workflow to include lint, test, and build steps for them.
- Surface failing steps promptly in PR descriptions; link to failing logs and note remediation progress.
- Consider adding targeted Playwright smoke tests or deploy previews once the pipeline remains stable.
