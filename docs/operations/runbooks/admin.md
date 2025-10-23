# Admin Runbook

Super Admins use the internal admin console (`apps/admin`) to investigate users,
manage impersonation, orchestrate bulk jobs, and review audit trails. Keep this
runbook handy for operational tasks and on-call triage.

## Access & prerequisites

- Admin access is restricted to privileged Supabase roles (OWNER, SUPPORT_LEAD,
  AUDITOR). Provision accounts through the identity service and confirm MFA is
  enforced.
- Promote a freshly created portal user with:

  ```bash
  pnpm promote:super-admin you@example.com
  ```

  The script uses the Supabase service-role key to set the appropriate
  `super-admin` flags in both `app_metadata` and `user_metadata` so the console
  can be accessed immediately after signup.
- The app depends on the identity service, worker queues, and Redis. Verify
  `REDIS_URL`, `SUPABASE_*`, and identity endpoints in the environment.
- Local development: `pnpm dev --filter @ma/admin` with identity + worker running.

## Core workflows

- **User search & detail** – Search by email or organization. Detail views display
  entitlements, session history, audit excerpts, and allow role changes.
- **Impersonation** – Start/stop impersonation from the user detail page. Identity
  issues a banner in portal/tasks; stop sessions promptly after use. Sessions
  expire automatically, but support must document reason codes in audit notes.
- **Bulk jobs** – Launch bulk activate/suspend/export jobs from the bulk actions
  wizard. Progress relies on worker queues; monitor status and retries. Finished
  jobs surface in notifications and audit logs.
- **Audit explorer** – Filter events by actor, organization, event type. Export data
  for compliance requests; ensure sensitive exports are stored securely.

## Billing Toolkit

- Enable `ADMIN_BILLING_ENABLED=true` to expose the billing navigation (`/billing`, `/billing/catalog`, `/billing/invoices`, `/billing/usage`, `/billing/credits`).
- Catalog changes (create/update package) immediately persist through identity; review diffs carefully before saving and mirror updates in release notes.
- Invoice actions (`Mark paid`, `Void`) trigger identity server actions—confirm status changes via the portal invoices page or Stripe dashboard, and document manual adjustments.
- Usage analytics filters accept organization, feature, tenant, product, and time-window parameters; set `featureKey=ai.tokens` to validate the seeded data path end to end.
- End-to-end coverage for these flows lives in `apps/e2e/tests/admin/billing.spec.ts`; run the suite before enabling billing for new cohorts.

## Monitoring & alerts

- Queue backlog (`identity-events`, `user-management`, `task-notifications`) should
  stay low. Rising delays indicate worker issues.
- Audit log gaps or impersonation banners that fail to appear typically trace back
  to identity outages or misconfigured Supabase service-role tokens.
- Track portal/admin health endpoints in uptime monitors; the admin app shares the
  same Next.js runtime as portal if deployed together.

## Incident response

- **Impersonation stuck active** – Stop from the admin UI; if the banner persists,
  clear the session via identity’s Supabase admin endpoint and verify worker logs
  for cleanup failures.
- **Bulk job failures** – Retry from the job detail view. Check worker logs for
  payload validation errors. Ensure Redis memory isn’t exhausted.
- **Unauthorized access attempt** – Revoke affected sessions, rotate credentials,
  and review audit logs. Update incident playbook (`docs/operations/playbooks/incident-response.md`).

## References

- Architecture context: `docs/architecture/overview.md`
- Release plans: `docs/meta/plans/admin/`
- Automation guardrails: `docs/meta/automation.md`
- Deploy guidance: `docs/setup/deployment.md`
