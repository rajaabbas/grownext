## Monorepo Constitution

- TypeScript everywhere with strict compiler options and shared configuration from `@ma/config`.
- Turborepo orchestrates builds, linting, testing, and dev workflows across all workspaces.
- Boilerplate only—no domain or business-specific logic ships by default.
- APIs must validate input/output against shared `@ma/contracts` schemas.
- Database access is multi-tenant by default; row level security (`request.jwt.claims`) is required for every table.
- Shared infrastructure primitives (env parsing, logging, auth helpers, queues) live in packages to prevent duplication.
