# Portal Runbook

The portal application is a Next.js App Router site responsible for sign-in, tenant administration, permissions management, and product launch. This runbook covers day-to-day operations.

## Service Overview

- **Location**: `apps/portal`
- **Build**: `pnpm build:portal` (Next.js production build)
- **Runtime**: Node.js 20+, served via Next.js server or edge runtime
- **Dependencies**: Supabase for session cookies, identity service for API aggregate data
- **Environment**: `PORTAL_PORT` (default `3200`)

## Deployment Notes

- Builds require Supabase env vars even during prerender. Defaults are injected via `next.config.cjs`, but production deployments must set real values.
- `/api/*` routes are marked `force-dynamic` to avoid static rendering; they proxy authenticated requests to the identity service.
- Static assets and incremental routes follow standard Next.js conventions.

## Health Checks

- Configure your ingress to hit `/api/status` (or a lightweight page such as `/login`) for warm-up checks.
- Monitor Next.js logs for `prerender-error`—usually missing env vars or upstream identity outages.

## Key Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client config for the browser |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase operations (profile updates, session lookup) |
| `NEXT_PUBLIC_IDENTITY_BASE_URL` | Public identity endpoint for REST calls |
| `PORTAL_SESSION_SECRET` | Cookies for transient server actions (if used) |
| `APP_BASE_URL` | Canonical portal URL for redirects |

## Operational Tasks

- **Purge build cache**: `pnpm clean:portal` (if you add one) or delete `.next/`.
- **Rotate Supabase keys**: Update env vars and redeploy; ensure portal and tasks share the same anon key.
- **Update permissions catalog**: Modify `apps/portal/lib/portal-permission-catalog.ts` and regenerate docs (`../reference/permissions.md`).
- **Expose new products**: After identity surfaces a new product via `/portal/launcher`, add or update tiles in `LaunchpadDashboard` to link the app. Coordinate with the [product app guide](../../architecture/adding-product-app.md) so portal, identity, and admin all roll out together.

## Troubleshooting

| Issue | Remediation |
| --- | --- |
| 401s from `/api/launcher` | Supabase session cookie missing or Supabase env vars misconfigured; verify `NEXT_PUBLIC_SUPABASE_*` and `supabase.auth.getSession()` in route handlers. |
| Build fails with Supabase error | Ensure defaults in `next.config.cjs` were not removed; CI needs placeholder values. |
| Portal loads but launcher is empty | Identity service might be unreachable; check `IDENTITY_BASE_URL` and inspect response body for error message. |
| Logout leaves user signed in | Verify front-end uses Supabase `auth.signOut()` and the identity `/auth/logout` endpoint if implemented. |

Escalate to the identity team if issues stem from authorization flows or Supabase outages.
