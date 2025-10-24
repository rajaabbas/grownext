# Base Apps Hardening – Release Notes (v0.2.0)

## Identity (v0.2.0)
- Enforced organization-scoped guards across `/admin/*` routes; mismatched tokens now return `403 organization_scope_mismatch` before hitting data access.
- Added rate-limit tuning knobs (`IDENTITY_RATE_LIMIT_MAX`, `IDENTITY_RATE_LIMIT_TIME_WINDOW`, `IDENTITY_RATE_LIMIT_ALLOW_LIST`) with structured `rate_limit_exceeded` responses.
- Expanded super-admin audit exports and API payloads with `actorEmail`, `ipAddress`, `userAgent`, and JSON metadata to support incident timelines.
- Extended `@ma/identity-client` billing helpers to accept request context (`X-Organization-Id` / `X-Tenant-Id`) and updated portal/admin consumers accordingly.
- Refreshed identity runbook with guardrails, smoke automation pointers, and rollback guidance.

## Portal (v0.2.0)
- Billing API routes now forward organization context to identity, aligning with the tightened guard and improving audit fidelity.
- Server components tolerate new identity errors and surface guard mismatches with actionable messaging.
- Runbook updated with troubleshooting steps for `organization_scope_mismatch` and context refresh guidance.

## Admin (v0.2.0)
- UI/API requests respect the active organization guard; support agents must switch org context before issuing mutations.
- Audit explorer surfaces the new identity metadata columns; exports now capture actor IP and user agent alongside existing fields.
- Incident response playbooks call out the guard behavior so on-call engineers can reset context quickly.

## Tasks (v0.2.0)
- Documented tenant guard expectations (`x-tenant-id`) and new worker throttling signals in the Tasks runbook.
- Reinforced billing instrumentation guidance with pointers to worker log messages for aggregation throttling.

## Worker (v0.2.0)
- Added structured warning logs when super-admin bulk job operations fail (userId, jobId, action) and when billing aggregations are throttled by identity.
- Updated runbook monitoring/troubleshooting sections to highlight the new log patterns and remediation steps.

## Release Process
- Introduced an identity smoke pipeline trigger after each deploy covering launcher, admin org endpoints, impersonation stop/start, and billing API flows. Results post to Slack for quick regression checks.
- Rate-limit overrides and guard rollbacks are now documented with step-by-step remediation guidance in the identity runbook.
