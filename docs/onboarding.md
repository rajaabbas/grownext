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
4. Apply Prisma migrations and seed baseline data:
   ```bash
   pnpm --filter @ma/db prisma migrate dev --name init
   pnpm db:seed
   ```
5. (Optional) Load dedicated dev ports so multiple apps can run together:
   ```bash
   set -a; source .env.dev; set +a
   ```
6. Run the platform:
   ```bash
   PORT=$IDENTITY_PORT pnpm --filter @ma/identity dev &
   PORT=$PORTAL_PORT pnpm --filter @ma/portal dev &
   PORT=$TASKS_PORT pnpm --filter @ma/tasks dev &
   wait
   ```
   Start additional apps with their assigned ports (`PORT=$DESIGN_PORT`, etc.). If you introduce a standalone API service, bind it to `API_PORT`. Workers currently have no HTTP listener but can use `WORKER_PORT` for tooling that expects a dedicated value.

## Supabase Configuration

- The identity service expects Supabase GoTrue to manage users. Configure email providers and OTP templates inside the Supabase dashboard if you plan to send real email.
- MFA enrollment relies on TOTP; enable "Authenticator" in Supabase authentication settings.

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

## Troubleshooting

- **Authorization code issues**: ensure Supabase session cookies are being forwarded to `/oauth/authorize` and that the product redirect URI is registered in `packages/db` seed data.
- **JWT verification failures**: confirm the product app is using the correct audience (`<product>_CLIENT_ID`) and issuer URL matches the identity service base URL.
- **Queue processing**: check Redis connectivity and the worker logs. Jobs are emitted on `identity-events` and `user-management-jobs` queues.
