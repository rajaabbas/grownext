# Security FAQ (v0.2.0 Refresh)

This FAQ captures the guardrails introduced during the Oct 23 base-apps hardening sprint. Share it with support,
implementation, and incident-response teams so we have a consistent story when customers or auditors ask how we protect tenant boundaries.

## How are tenants isolated?

- Every API call must present an organization context. Identity now rejects mismatched requests with `403 organization_scope_mismatch`.
- Portal, Admin, and internal service clients forward the active organization via `X-Organization-Id` (and `X-Tenant-Id` when applicable). If operators see scope errors, have them relaunch the app to refresh their Supabase token before retrying.
- Runbooks: Identity (`docs/operations/runbooks/identity.md`), Portal (`docs/operations/runbooks/portal.md`), Admin (`docs/operations/runbooks/admin.md`), and Worker (`docs/operations/runbooks/worker.md`) outline remediation steps per surface.

## What happens when a refresh token expires or is rotated?

- Refresh token lifetime is now configurable via `IDENTITY_REFRESH_TOKEN_TTL_SECONDS` and defaults to 30 days.
- The token service revokes any previous refresh token when issuing a new set and cleans up a full session with `rotateSession`. Expired tokens are revoked automatically on validation.
- Worker queue consumers should treat `401`/`403` responses as a signal to refresh identity context (see the worker runbook “Token expiry handling” section).

## How do we handle 2FA and session state changes?

- Identity rejects stale tokens emitted prior to 2FA enrollment changes. Clients must prompt users to sign in again when they receive `401` with `reason=expired`.
- Portal/Admin UI copy has been updated to call out the new expiry behavior (see app plans for follow-up work).
- Support guidance: if a user is locked out after enabling 2FA, revoke their existing sessions from the Super Admin console and ask them to complete enrollment again.

## What prevents runaway impersonation sessions?

- Super Admin impersonation tokens are time-boxed. The cleanup job revokes expired sessions and logs `super-admin.impersonation.stopped` audit events automatically.
- Identity exposes `/super-admin/impersonation/cleanup` for on-demand sweeps. Admin runbook now includes the sequence and expected log entries.
- Portal surfaces a persistent banner while impersonating; stopping the session generates a corresponding audit export entry.

## Where can I find onboarding guidance that reflects these changes?

- Updated onboarding notes live in `docs/setup/onboarding.md` (new in v0.2.0). They describe required headers, recommended smoke checks, and failure recovery when provisioning tenants under the tighter guardrails.
- For product owners adding a new app, follow the “Tenant guardrails” checklist in the identity runbook and confirm the onboarding docs before shipping.
