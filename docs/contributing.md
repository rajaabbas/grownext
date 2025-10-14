# Contribution Guidelines

## Workflow

- Follow a short-lived feature branch model: `main` stays deployable, branches use `feature/<scope>` naming.
- Open draft pull requests early to surface CI feedback and architectural questions.
- Rebase interactively before merging to keep history linear and avoid merge commits.

## Expectations

- **Tests**: Run `pnpm test` (or scope via `pnpm --filter <pkg> test`) before opening a PR. Add coverage for new behavior in the appropriate workspace (Fastify unit tests, Vitest component tests, or package-level tests).
- **Type safety**: Execute `pnpm typecheck` to ensure TS errors are caught across apps and packages.
- **Linting**: `pnpm lint` delegates to Next/ESLint configs—ensure lint errors are resolved before requesting review.
- **Database changes**: Extend `packages/db/prisma/schema.prisma`, generate a migration (`pnpm --filter @ma/db prisma migrate dev --name <description>`), and run `pnpm --filter @ma/db test` to regenerate types.

## Commit Style

- Use conventional commits (`feat:`, `fix:`, `docs:`…) to keep changelog generation straightforward.
- Keep commits focused: schema change + generated migration, feature implementation, and docs updates should be separate commits when possible.

## Pull Request Checklist

- [ ] Tests, type-check, and lint succeed locally.
- [ ] Migrations (when applicable) are included and seed scripts updated.
- [ ] Docs (`docs/`, app READMEs) reflect new capabilities or operational steps.
- [ ] CI passes (lint, typecheck, test, build jobs).

## Coding Notes

- Prefer composition over inheritance. Shared logic belongs in `packages/` (e.g., `identity-client`, `contracts`).
- Keep API responses Zod-validated via `@ma/contracts` schemas.
- Observe logging discipline—Fastify routes should log structured objects via `logger` from `@ma/core`.
- When integrating with external services, add retry/backoff logic in workers instead of synchronous API handlers.
