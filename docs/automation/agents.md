# Automation Guardrails

Automation agents (including Codex runs) must respect the service boundaries that keep identity, portal, and product apps decoupled.

## Identity ↔ Product Boundary

- Only the identity service (`apps/identity`) may import `@ma/db`. Product apps interact with identity exclusively through HTTP endpoints.
- Federation (SAML) terminates at the identity service (`/saml/:slug/acs`). Product apps should never contact external IdPs directly.
- Tasks data is stored in `@ma/tasks-db`. When product features need identity-derived metadata (e.g., owner display names), call identity endpoints such as `/internal/tasks/context` or `/internal/tasks/users`.
- When new cross-service capabilities are required:
  1. Design or extend an identity API route.
  2. Add/modify helpers in `@ma/identity-client`.
  3. Consume the helper from the product app.

## Implementation Expectations

- Run `pnpm --filter @ma/tasks lint` / `typecheck` and matching identity commands after modifying cross-service flows.
- Extend shared Zod contracts in `@ma/contracts` when introducing new payloads so identity, SDKs, and product apps stay aligned.
- Update documentation (architecture, reference docs, runbooks) if the boundary shifts.
- Before bumping any package version, consult the corresponding plan in `docs/plans/<app>/vX.Y.Z.md`.  
  - Keep the plan current while implementing the scoped work.  
  - Update the package version to match the plan once tasks ship, and draft the next plan immediately afterward.

Adhering to these guardrails keeps automation safe and prevents accidental coupling across services.
