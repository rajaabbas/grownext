# Tenant Onboarding Checklist (v0.2.0)

These steps keep tenant provisioning aligned with the guardrails shipped in the Oct 23 base-apps hardening sprint. Follow them whenever you stage or launch a new customer environment.

## 1. Pre-flight

- Confirm identity is running with updated env flags:
  - `IDENTITY_RATE_LIMIT_MAX` / `IDENTITY_RATE_LIMIT_TIME_WINDOW` tuned for the target environment.
  - `IDENTITY_RATE_LIMIT_ALLOW_LIST` includes any shared bastion IPs used for scripted onboarding.
- Ensure the portal/admin apps you plan to use are on the latest build so they pass the organization headers required by the new guardrails.

## 2. Provisioning sequence

1. Use the Super Admin console (or the `create-tenant` script) to create the organization and default tenant.
2. Grant product entitlements via the identity admin API. This step now fails fast if the session lacks an organization scope.
3. Invite initial operators. Invitations must be accepted by accounts with matching email addresses—double-check the audit log for `INVITATION_CREATED` and `ADMIN_ACTION` events.

## 3. Smoke checks

Run these in staging before moving to production:

- **Portal launcher**: authenticate as the invited operator and hit `/portal/launcher`. Expected result is a 200 with tenant membership populated; 4xx responses indicate scope headers are missing.
- **Admin impersonation cleanup**: start an impersonation session, let it expire, then trigger `/super-admin/impersonation/cleanup`. The audit export should include `super-admin.impersonation.stopped`.
- **Worker consumers**: enqueue a test notification or billing-usage job. Monitor worker logs for `Billing usage aggregation throttled` or token expiry warnings.

## 4. Troubleshooting

- `403 organization_scope_mismatch`: the client is sending stale Supabase claims. Sign out/in or impersonate via Super Admin to refresh.
- `rate_limit_exceeded`: use the fail-safe runbook in `docs/operations/runbooks/identity.md` to apply a temporary override, then re-run the smoke pipeline.
- Onboarding automation failing to fetch owners: ensure every request includes `X-Organization-Id` and the target tenant in the query/header. The helper functions in `@ma/identity-client` now accept `{ context: { organizationId, tenantId } }` for this purpose.

Document any deviations in the plan files so follow-up tasks can be scheduled for the relevant app sprint.

## 5. Portal smoke suite

When automation raises questions about a deployment, run the lightweight Playwright checks before escalating:

- Start the app stack locally (`pnpm dev --filter @ma/portal`) or in a staging slot with seeded data.
- Export the service-role credentials used by the fixtures (`cp apps/e2e/.env.example apps/e2e/.env` and fill in the Supabase keys if you have not already).
- Execute `pnpm --filter @ma/e2e run test:smoke -- --grep portal` to cover login, launchpad visibility, impersonation banners, and tenant switching. The suite now asserts that organization headers are present on every identity call.
- Capture the report artefact under `apps/e2e/playwright-report` (or the CI artifact) and attach it to the release ticket when requesting manual sign-off.
