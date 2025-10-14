# Architecture Overview

## Platform Topology

```
+-------------------+        +-------------------------+        +----------------------+
|   Portal (Next)   |  OIDC  |   Identity Service      |  Jobs  |   Worker (BullMQ)    |
| - SSO + Launcher  +------->+ - Fastify + Supabase    +------->+ - Tenant provisioning |
| - Tenant UI       |        | - OAuth2, Admin APIs    |        | - Invitation emails  |
| - Session Mgmt    |        | - Portal aggregates     |        | - Tasks bootstrap     |
+---------+---------+        +-----------+-------------+        +-----------+----------+
          |                               |                                 |
          | Access Tokens                 | Prisma                          |
          v                               v                                 v
+---------+---------+        +-------------------------+        +----------------------+
| Product Apps      |        | Postgres (Prisma)       |        | Supabase GoTrue      |
| (Tasks, Design)   |        | - Tenants, Products     |        | - Users, MFA, Sessions|
|  Website, Design) |        | - Entitlements, Audit   |        |                        |
+-------------------+        +-------------------------+        +----------------------+
```

> Tasks persistence is handled by a dedicated Postgres instance via `@ma/tasks-db` and the `TASKS_DATABASE_URL` connection string, while identity data continues to live in the core database managed by `@ma/db` (exposed only through the identity service).

- **Identity service** is the single source of truth for OAuth2/OIDC flows, organizations, tenants, products, and entitlements. It wraps Supabase GoTrue for user lifecycle operations.
- **Portal** consumes the identity APIs to deliver SSO entry points, tenant administration, session management, and product discovery via the `/portal/launcher` aggregate endpoint.
- **Product applications** resolve tenancy context via the identity HTTP surface (`/internal/tasks/*`) and validate short-lived access tokens using `@ma/identity-client` before mutating product data.
- **Worker** processes outbound identity events (tenant provisioning, invitation dispatch, audit expansion, Tasks bootstrapping) via BullMQ.

## Request Flow Summary

| Step | Component | Description |
| ---- | --------- | ----------- |
| 1 | Portal / Product | User is redirected to `/oauth/authorize` with PKCE parameters. |
| 2 | Identity Service | Validates Supabase session, entitlements, and issues an authorization code. |
| 3 | Portal / Product | Exchanges the code at `/oauth/token`, setting an HttpOnly refresh token cookie and receiving an access token & ID token. |
| 4 | Portal | Calls `/portal/launcher` to hydrate UI widgets with live organization, tenant, product, and session data. |
| 5 | Product API / Worker | Calls `/internal/tasks/context` with the caller's Supabase access token to resolve active tenant, organization, and roles without touching the identity database. |
| 6 | Product API | Uses `@ma/identity-client` to verify the bearer token via JWKS, mapping entitlements and roles for authorization. |
| 7 | Identity Service | Records audit entries, maintains refresh token state, and emits queue jobs for downstream processing. |
| 8 | Worker | Reacts to admin API events (tenant creation, invitation issuance) to provision follow-up state (e.g., default Tasks reminders). |

## Data Model Highlights

- `Organization`, `Tenant`, `Product`, and `ProductEntitlement` model multi-tenant entitlements.
- `RefreshToken` captures per-client refresh tokens, session metadata, and rotation history.
- `Task` records live in the dedicated tasks database (`@ma/tasks-db`) and reference organization, tenant, and user IDs managed by the identity database without cross-database foreign keys.
- `AuditEvent` tracks sign-ins, token issuance, entitlements, and admin mutations.

## Identity Client Responsibilities

`@ma/identity-client` provides:

- JWKS fetching with caching via `IdentityTokenValidator`.
- Bearer token verification helpers for Next.js API routes or Fastify middleware.
- Normalized entitlement structures (product, tenant, roles) for RBAC enforcement.
- HTTP clients (e.g., `fetchTasksContext`) for retrieving tenancy context from the identity service without shared database access.

## External Dependencies

- **Supabase GoTrue** supplies user sessions, MFA state, and password resets. The identity service proxies privileged operations via the Supabase service key.
- **BullMQ/Redis** is used for async job orchestration (invitation emails, tenant bootstrap scripts).
- **Prisma + PostgreSQL** back the platform metadata via two generated clients: `@ma/db` (consumed only by the identity service) for identity/entitlement data and `@ma/tasks-db` for product-specific task records.
