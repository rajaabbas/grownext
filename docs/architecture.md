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

- **Identity service** is the single source of truth for OAuth2/OIDC flows, organizations, tenants, products, and entitlements. It wraps Supabase GoTrue for user lifecycle operations and now brokers SAML 2.0 service-provider flows per organization (metadata management, AuthnRequest generation, ACS validation).
- **Portal** consumes the identity APIs to deliver SSO entry points, tenant administration, session management, and product discovery via the `/portal/launcher` aggregate endpoint.
- **Product applications** resolve tenancy context via the identity HTTP surface (`/internal/tasks/*`) and validate short-lived access tokens using `@ma/identity-client` before mutating product data.
- **Worker** processes outbound identity events (tenant provisioning, invitation dispatch, audit expansion, Tasks bootstrapping) via BullMQ and now emits product-facing notifications (task assignment, comments, due-soon reminders) on the `task-notifications` queue.

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

### SAML Federation Path (Optional)

| Step | Component | Description |
| ---- | --------- | ----------- |
| 0 | Org Admin | Registers IdP metadata through `/admin/organizations/:id/saml/connections` (uploads XML, configures redirect bindings, certs). |
| 1 | Portal / IdP Launcher | Issues `GET /saml/:slug/login`; identity generates a signed AuthnRequest with the per-connection SP keys. |
| 2 | External IdP | Authenticates the user (MFA, policies) and posts a signed SAMLResponse to `/saml/:slug/acs`. |
| 3 | Identity Service | Validates XML signatures, issuer, audience, clock skew, and links the NameID/email to an existing user profile, creating a `SamlAccount` record as needed. |
| 4 | Identity Service | Emits `SIGN_IN` audit event and hands control back to the standard OAuth/OIDC code exchange to mint internal access/refresh tokens. |

SAML can be disabled globally (set `IDENTITY_SAML_ENABLED=false`)—the OAuth/OIDC topology above continues to function without change.

## Data Model Highlights

- `Organization`, `Tenant`, `Product`, and `ProductEntitlement` model multi-tenant entitlements.
- `RefreshToken` captures per-client refresh tokens, session metadata, and rotation history.
- `Task` records live in the dedicated tasks database (`@ma/tasks-db`) and reference organization, tenant, and user IDs managed by the identity database without cross-database foreign keys.
- `Project`, `TaskSubtask`, `TaskComment`, `TaskFollower`, and `TaskPermissionPolicy` tables extend the Tasks workload with project organization, lightweight checklists, comment threads, follower lists, and fine-grained overrides enforced alongside identity roles.
- `AuditEvent` tracks sign-ins, token issuance, entitlements, admin mutations, and successful/failed SAML assertions.
- `SamlConnection` persists per-organization IdP configuration (entity ID, SSO/SLO endpoints, signing certs), while `SamlAccount` stores the NameID↔user linkage created after the first assertion.

### Tasks Application Highlights

- Board and list views share a unified `/api/tasks` surface that supports project filters, status changes, and the "My Tasks" aggregation.
- Tasks carry extended metadata (description, due date, priority), collaboration primitives (subtasks, comments, followers), and optimistic client updates with toast feedback.
- The `/api/projects` and `/api/settings/permissions` routes expose project summaries and per-project overrides that the settings UI renders as a matrix.
- Identity context (`/internal/tasks/context`) now returns projects, project summaries, and effective permissions to drive the project picker and guard UI affordances.

## Service Boundaries & SDKs

- TypeScript path aliases and ESLint rules enforce that only the identity service can import `@ma/db`; downstream apps must rely on HTTP endpoints and the published SDKs. Attempting to pull Prisma models directly from product code now fails both linting and builds.
- Shared packages that are safe for cross-service consumption live in `packages/` and are built via `tsc --build`. In particular, `@ma/contracts` (HTTP schemas) and `@ma/identity-client` (token helpers + HTTP clients) emit publishable bundles with semantic version changelogs.
- Product apps consume identity context through `@ma/identity-client` HTTP helpers such as `fetchTasksContext`, while service-to-service integrations rely on contracts in `@ma/contracts` to stay version-aligned.

## Identity Client Responsibilities

`@ma/identity-client` provides:

- JWKS fetching with caching via `IdentityTokenValidator`.
- Bearer token verification helpers for Next.js API routes or Fastify middleware.
- Normalized entitlement structures (product, tenant, roles) for RBAC enforcement.
- HTTP clients (e.g., `fetchTasksContext`) for retrieving tenancy context from the identity service without shared database access.

## External Dependencies

- **Supabase GoTrue** supplies user sessions, MFA state, and password resets. The identity service proxies privileged operations via the Supabase service key.
- **BullMQ/Redis** is used for async job orchestration (invitation emails, tenant bootstrap scripts, task notification fan-out via the `task-notifications` queue).
- **Prisma + PostgreSQL** back the platform metadata via two generated clients: `@ma/db` (consumed only by the identity service) for identity/entitlement data and `@ma/tasks-db` for product-specific task records.
- **samlify** provides XML parsing/signature verification for the service-provider implementation.
