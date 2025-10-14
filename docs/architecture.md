# Architecture Overview

## Platform Topology

```
+-------------------+        +-------------------------+        +----------------------+
|   Portal (Next)   |  OIDC  |   Identity Service      |  Jobs  |   Worker (BullMQ)    |
| - SSO + Launcher  +------->+ - Fastify + Supabase    +------->+ - Tenant provisioning |
| - Tenant UI       |        | - OAuth2, Admin APIs    |        | - Audit fan-out       |
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

- **Identity service** is the single source of truth for OAuth2/OIDC flows, organizations, tenants, products, and entitlements. It wraps Supabase GoTrue for user lifecycle operations.
- **Portal** consumes the identity APIs to deliver SSO entry points, tenant administration, and product discovery.
- **Product applications** validate short-lived access tokens using `@ma/identity-client` and enforce RBAC locally.
- **Worker** processes outbound identity events (tenant provisioning, invitation dispatch, audit expansion) via BullMQ.

## Request Flow Summary

| Step | Component | Description |
| ---- | --------- | ----------- |
| 1 | Portal / Product | User is redirected to `/oauth/authorize` with PKCE parameters. |
| 2 | Identity Service | Validates Supabase session, entitlements, and issues an authorization code. |
| 3 | Portal / Product | Exchanges the code at `/oauth/token`, setting an HttpOnly refresh token cookie and receiving an access token & ID token. |
| 4 | Product API | Uses `@ma/identity-client` to verify the bearer token via JWKS, mapping entitlements and roles. |
| 5 | Identity Service | Records `TOKEN_ISSUED` or `TOKEN_REFRESHED` audit events and persists refresh token state. |
| 6 | Worker | Reacts to admin API events (tenant creation, invitation issuance) and propagates asynchronous work. |

## Data Model Highlights

- `Organization`, `Tenant`, `Product`, and `ProductEntitlement` model multi-tenant entitlements.
- `RefreshToken` captures per-client refresh tokens, session metadata, and rotation history.
- `AuditEvent` tracks sign-ins, token issuance, entitlements, and admin mutations.

## Identity Client Responsibilities

`@ma/identity-client` provides:

- JWKS fetching with caching via `IdentityTokenValidator`.
- Bearer token verification helpers for Next.js API routes or Fastify middleware.
- Normalized entitlement structures (product, tenant, roles) for RBAC enforcement.

## External Dependencies

- **Supabase GoTrue** supplies user sessions, MFA state, and password resets. The identity service proxies privileged operations via the Supabase service key.
- **BullMQ/Redis** is used for async job orchestration (invitation emails, tenant bootstrap scripts).
- **Prisma + PostgreSQL** back the platform metadata with generated client types for all services.
