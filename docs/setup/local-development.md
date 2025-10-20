# Local Development

This guide walks through setting up GrowNext on a fresh machine, wiring the required
Supabase credentials, seeding the databases, and exercising the common workflows.

## 1. Prerequisites

- Node.js 20.11+ (`.nvmrc` is provided)
- pnpm 8+
- Docker (used by the Supabase CLI stack and the shared Redis/Postgres services)
- Supabase CLI (recommended for managing the bundled Supabase instance)

> Tip: run `docker compose up supabase -d` from the repository root before starting the
> apps so the Supabase containers are already healthy.

## 2. Install workspace dependencies

```bash
pnpm install
```

Scopes are also available, e.g. `pnpm install:portal`, but most contributors take the
hit once with the full install.

## 3. Configure environment files

1. Copy `.env` to `.env.local` (or `.env.development`) and adjust values for your setup.
2. Source `.env.dev` when running multiple apps together; it sets non-conflicting port assignments.

```bash
set -a
source .env.dev
set +a
```

3. Populate Supabase credentials (see below) and any optional integrations such as SAML.
4. Reference `docs/reference/env-vars.md` whenever you need the authoritative variable catalogue.

### Generating Supabase credentials

The local stack uses the Supabase CLI with config in `supabase/config.toml`. After running
`supabase start` once, the CLI prints publishable and secret keys. For the portal and tests
you also need a **service-role** token with the `service_role` claim:

```bash
node - <<'NODE'
const crypto = require("node:crypto");
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";
const now = Math.floor(Date.now() / 1000);
const payload = {
  aud: "authenticated",
  exp: now + 60 * 60 * 24 * 365 * 10,
  sub: "service_role",
  role: "service_role",
  iss: "supabase"
};
const header = { alg: "HS256", typ: "JWT" };
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const signingInput = `${encode(header)}.${encode(payload)}`;
const signature = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
console.log(`${signingInput}.${signature}`);
NODE
```

Copy the printed token into both `SUPABASE_SERVICE_ROLE_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY`.

### Required CLI tooling

- `supabase start` – starts/refreshes the local Supabase cluster.
- `supabase stop` – shuts everything down if you need a clean restart.
- `pnpm --filter @ma/db run db:seed` – registers the default Tasks product and owner entitlement.
- `pnpm --filter @ma/tasks-db run db:seed` – seeds the Tasks product data model.

## 4. Seed identity & tasks databases

Run once per fresh database reset:

```bash
pnpm db:migrate && pnpm tasks-db:migrate
pnpm --filter @ma/db run db:seed
pnpm --filter @ma/tasks-db run db:seed
```

The combined shortcut `pnpm seed` performs both migrate + seed steps for identity and tasks.

## 5. Launch the platform

```bash
pnpm dev
```

This script loads `.env.dev` and starts identity, portal, admin, tasks, and worker in watch mode.
Use scoped commands (`pnpm dev:portal`, `pnpm dev:identity`, `pnpm dev:admin`, etc.) if you only need a subset.

## 6. First-run walkthrough

1. Visit `http://localhost:3200` and sign up (Supabase email/password).
2. The onboarding flow provisions an organization and default tenant automatically.
3. Open the Launchpad dashboard to confirm stats, admin actions, notifications, and quick links.
4. Launch the Tasks tile to validate the tenant entitlement that was seeded earlier.
5. Explore profile/session management and impersonation banners; try a password reset to exercise email flows (Mailpit runs on port `54324`).
6. Log into the Super Admin console (`http://localhost:3500` by default) to verify user search, impersonation start/stop, and bulk job status updates.
   Promote your account with `pnpm promote:super-admin <email>` if you need
   immediate admin access.

## 7. Testing checklist

| Command | Purpose |
| --- | --- |
| `pnpm -C apps/portal test` | Portal Vitest suite (components, utilities). |
| `pnpm --filter @ma/e2e run test:portal` | Playwright suite (requires running dev servers and seeded data). |
| `pnpm test:identity` / `pnpm test:tasks` | Service-specific unit tests. |
| `pnpm lint` / `pnpm typecheck` | Repository-wide static analysis. |

For e2e tests ensure the service-role token and seeds are in place; Playwright fixtures rely on them to create organizations and entitlements.

## 8. Troubleshooting

- **Invalid Supabase JWT** – regenerate the service-role token using the script above; restart the dev servers so new env vars are picked up.
- **Tasks entitlement missing** – rerun `pnpm --filter @ma/db run db:seed` to register the Tasks product for the seeded organization.
- **Portal alignment issues after login** – confirm you’re running the latest portal build; the authenticated layout now lives under `app/(portal)/layout.tsx`.

Continue with deployment specifics in `docs/setup/deployment.md`, or dive into architecture details in `docs/architecture/overview.md`.
