# Onboarding

## Prerequisites

- Node.js 20.11+
- pnpm 8+
- Docker (for running Supabase locally)
- Redis (local `redis-stack` container is fine)

## First-time Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy `.env` and adjust secrets as needed. The sample file includes default keys for local Supabase and product client IDs (`TASKS_CLIENT_ID`, etc.).
3. Start Supabase:
   ```bash
   docker compose up supabase -d
   ```
4. Apply Prisma migrations and seed baseline data for both databases:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   pnpm tasks-db:migrate
   pnpm tasks-db:seed
   ```
5. (Optional) Load dedicated dev ports so multiple apps can run together:
   ```bash
   set -a; source .env.dev; set +a
   ```
6. Run the platform:
   ```bash
   pnpm dev
   ```
   The dev script automatically loads `.env.dev`, assigns ports, and starts identity, portal, tasks, and worker processes. Extend `scripts/dev.mjs` if you add more product apps.
7. Visit the portal (`http://localhost:3200`) to complete sign-up/sign-in, create tenants, and launch the Tasks product to confirm end-to-end data flows. You can exercise the password recovery flow by requesting a reset from the login page; recovery links land on `/auth/reset-password` in the portal.

## Supabase Configuration

- The identity service expects Supabase GoTrue to manage users. Configure email providers and OTP templates inside the Supabase dashboard if you plan to send real email. Populate `IDENTITY_BASE_URL`/`NEXT_PUBLIC_IDENTITY_BASE_URL` so the portal can reach Fastify endpoints.
- MFA enrollment relies on TOTP; enable "Authenticator" in Supabase authentication settings. Portal profile pages now surface session information directly from the identity service and allow end users to update their name, email, and organization display name without leaving the console.
- The Tasks product runs against its own Supabase stack. Use `supabase/tasks/config.toml` when starting the CLI locally so migrations and RLS policies from `supabase/tasks/policies/tasks.sql` target the dedicated `tasks` schema.

## Common Commands

- `pnpm test` – run workspace tests (Fastify, packages, Next.js component tests).
- `pnpm lint` – execute ESLint across apps.
- `pnpm typecheck` – ensure TypeScript types compile everywhere.
- `pnpm --filter @ma/identity dev` – start the identity service with live reload.
- `pnpm --filter @ma/worker dev` – run background jobs.

## Identity Client Integration

Product apps should:

1. Install the workspace dependency (`@ma/identity-client` already linked in each app).
2. Configure environment variables:
   ```env
   IDENTITY_ISSUER=http://localhost:4000
   IDENTITY_JWKS_URL=http://localhost:4000/.well-known/jwks.json
   TASKS_CLIENT_ID=tasks
   ```
3. Use the helper from `@ma/identity-client` to verify API requests. Example for Next.js API routes:
   ```ts
   import { IdentityTokenValidator, verifyAuthorizationHeader } from "@ma/identity-client";

   const validator = new IdentityTokenValidator({
    expectedAudience: process.env.TASKS_CLIENT_ID!,
     expectedIssuer: process.env.IDENTITY_ISSUER!,
     jwksUrl: process.env.IDENTITY_JWKS_URL!
   });

   export async function GET(request: Request) {
     const token = await verifyAuthorizationHeader(request.headers, validator);
     // enforce roles via token.entitlements
   }
   ```
4. Consult [`docs/Agents.md`](./Agents.md) for the service boundary rules between identity and product apps. Owner metadata and similar identity-sourced details must be fetched through the provided helpers (e.g. `fetchTasksContext`, `fetchTasksUsers`) rather than importing `@ma/db` into product code.

## Troubleshooting

- **Authorization code issues**: ensure Supabase session cookies are being forwarded to `/oauth/authorize` and that the product redirect URI is registered in `packages/db` seed data.
- **JWT verification failures**: confirm the product app is using the correct audience (`<product>_CLIENT_ID`) and issuer URL matches the identity service base URL.
- **Queue processing**: check Redis connectivity and the worker logs. Jobs are emitted on `identity-events` and `user-management-jobs` queues.
- **Tasks API access**: ensure the active identity token includes a role (`OWNER`, `ADMIN`, `EDITOR`, or `CONTRIBUTOR`) for the Tasks product and tenant; otherwise POST/PATCH routes will respond with 403.
