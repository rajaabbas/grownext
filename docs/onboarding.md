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
   # or target a single service
   pnpm install:identity
   pnpm install:tasks
   ```
2. Copy `.env` and adjust secrets as needed. The sample file includes default keys for local Supabase, product client IDs (`TASKS_CLIENT_ID`, etc.), and placeholders for the optional SAML SP entity ID and signing keys (`IDENTITY_SAML_SP_*`). Leave the SAML values blank unless you intend to test federation.
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
   # or run the shortcut
   pnpm seed
   ```
5. (Optional) Load dedicated dev ports so multiple apps can run together:
   ```bash
   set -a; source .env.dev; set +a
   ```
6. Run the platform:
   ```bash
   pnpm dev
   ```
   The dev script automatically loads `.env.dev`, assigns ports, and starts identity, portal, tasks, and worker processes. Extend `scripts/dev.mjs` if you add more product apps. Use the scoped helpers (`pnpm dev:identity`, `pnpm dev:portal`, `pnpm dev:tasks`, `pnpm dev:worker`) when you only need a single service.
7. Visit the portal (`http://localhost:3200`) to complete sign-up/sign-in, create tenants, and launch the Tasks product. Explore the project picker, the list and board views, the "My Tasks" aggregation, task details (subtasks, followers, comments), and the permissions center at `/tasks/settings?tenantId=...` to confirm end-to-end data flows. You can exercise the password recovery flow by requesting a reset from the login page; recovery links land on `/auth/reset-password` in the portal. If SAML is enabled, you can also call `/saml/:slug/login` once you register a connection to confirm assertion handling.

## Supabase Configuration

- The identity service expects Supabase GoTrue to manage users. Configure email providers and OTP templates inside the Supabase dashboard if you plan to send real email. Populate `IDENTITY_BASE_URL`/`NEXT_PUBLIC_IDENTITY_BASE_URL` so the portal can reach Fastify endpoints.
- MFA enrollment relies on TOTP; enable "Authenticator" in Supabase authentication settings. Portal profile pages now surface session information directly from the identity service and allow end users to update their name, email, and organization display name without leaving the console.
- The Tasks product runs against its own Supabase stack. Use `supabase/tasks/config.toml` when starting the CLI locally so migrations and RLS policies from `supabase/tasks/policies/tasks.sql` target the dedicated `tasks` schema.

## Environment Variables by Service

| Service   | Key Variables (see `.env.example` / `.env.dev`)                                        |
|-----------|-----------------------------------------------------------------------------------------|
| Identity  | `IDENTITY_PORT`, `IDENTITY_ISSUER`, `IDENTITY_JWT_*`, `SUPABASE_*`, `IDENTITY_SAML_*`    |
| Portal    | `PORTAL_PORT`, `NEXT_PUBLIC_IDENTITY_BASE_URL`, `SUPABASE_*`, `PORTAL_SESSION_SECRET`     |
| Tasks     | `TASKS_PORT`, `TASKS_PRODUCT_SLUG`, `NEXT_PUBLIC_IDENTITY_BASE_URL`, `TASKS_DATABASE_URL`|
| Worker    | `WORKER_PORT`, `IDENTITY_BASE_URL`, `REDIS_URL`, `SUPABASE_SERVICE_ROLE_KEY`             |

Document any overrides in service-specific `.env.local` files to keep secrets out of the shared template.

## Common Commands

- `pnpm dev` – run the full platform. Scoped variants: `pnpm dev:identity`, `pnpm dev:portal`, `pnpm dev:tasks`, `pnpm dev:worker`.
- `pnpm build` – build everything. Scoped builds: `pnpm build:identity`, `pnpm build:portal`, `pnpm build:tasks`, `pnpm build:worker`.
- `pnpm test` – run all Vitest suites. Scoped tests: `pnpm test:identity`, `pnpm test:portal`, `pnpm test:tasks`, `pnpm test:worker`.
- `pnpm lint` – execute ESLint across apps.
- `pnpm typecheck` – ensure TypeScript types compile everywhere.
- `pnpm db:migrate` / `pnpm db:seed` and `pnpm tasks-db:migrate` / `pnpm tasks-db:seed` – manage Prisma migrations. Use `pnpm seed` to invoke both seeders.
- `pnpm --filter @ma/worker dev` – run background jobs.
- `pnpm --filter @ma/e2e test:portal` (or `test:tasks`, `test:identity`, `test:smoke`) – run focused Playwright suites once the dev server is live.

## Tasks Application Quick Tour

- **Projects & filters:** the Tasks landing page exposes a project picker, list/board/My Tasks views, and inline stats calculated from the `/api/tasks` response. Use the **New Project** button beside the picker to create and color-code projects backed by `/api/projects`.
- **Projects hub:** the `/tasks/projects?tenantId=...` view surfaces project cards with total/open/completed task counts and an add-project workflow for quick portfolio management.
- **Workspace chrome:** a GN-branded top bar and sidebar keep navigation consistent; access projects, tasks, and templates quickly, and use the avatar menu for settings or logout.
- **Detail panel:** select any task to manage description, subtasks, comments, followers, assignment, and project in a side panel with optimistic toast feedback.
- **Permissions Center:** navigate to `/tasks/settings?tenantId=...` to review or override per-project permissions; the page uses `/api/settings/permissions` and `/api/users` to display friendly names.
- **Notifications:** assignment changes, new comments, and due-soon reminders enqueue BullMQ jobs on `task-notifications`; the worker logs simulate outbound email delivery.

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

## Optional: Testing SAML Locally

1. **Enable the feature:** set `IDENTITY_SAML_ENABLED=true` and provide development SP keys (`IDENTITY_SAML_SP_ENTITY_ID`, `IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY`, `IDENTITY_SAML_SP_SIGNING_CERT`).
2. **Run a stub IdP:** launch a SimpleSAMLphp container for quick testing:
   ```bash
   docker run --name saml-idp \
     -p 8080:8080 \
     -p 8443:8443 \
     -e SIMPLESAMLPHP_SP_ENTITY_ID=http://localhost:3100/saml/demo/acs \
     -e SIMPLESAMLPHP_SP_ASSERTION_CONSUMER_SERVICE=http://localhost:3100/saml/demo/acs \
     ghcr.io/craftyworks/simplesamlphp-idp:latest
   ```
   The IdP metadata is available at `https://localhost:8443/simplesaml/saml2/idp/metadata.php` (self-signed cert; accept the warning).
3. **Register a connection:** call `/admin/organizations/:id/saml/connections` with the metadata XML (or configure manually via slug/URLs/certs). The identity service stores the details in `SamlConnection` and exposes the matching `/saml/:slug/*` routes.
4. **Validate the flow:** visit `http://localhost:3100/saml/demo/login`, authenticate with the stub IdP credentials, and inspect the JSON payload returned from `/saml/:slug/acs`. Ensure the email released by the IdP matches an existing user so the assertion links successfully.
5. **Clean up:** stop the container (`docker rm -f saml-idp`) and flip `IDENTITY_SAML_ENABLED=false` when federation testing is complete.

> SAML is optional—skip this section entirely if you are not integrating with a customer IdP.

## Troubleshooting

- **Authorization code issues**: ensure Supabase session cookies are being forwarded to `/oauth/authorize` and that the product redirect URI is registered in `packages/db` seed data.
- **JWT verification failures**: confirm the product app is using the correct audience (`<product>_CLIENT_ID`) and issuer URL matches the identity service base URL.
- **Queue processing**: check Redis connectivity and the worker logs. Jobs are emitted on `identity-events`, `user-management-jobs`, and `task-notifications` queues.
- **Tasks API access**: ensure the active identity token includes a role (`OWNER`, `ADMIN`, `EDITOR`, or `CONTRIBUTOR`) for the Tasks product and tenant; otherwise POST/PATCH routes will respond with 403.
