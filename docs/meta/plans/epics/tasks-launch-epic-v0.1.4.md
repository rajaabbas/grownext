# Tasks Launch Readiness – Epic Overview (v0.1.4)

> Status: 🚧 In progress (Nov 2025). The Tasks product is feature-complete behind flags; this epic focuses on polish, cross-app integrations, load readiness, and launch enablement.

## Scope & Objectives
- Deliver production-ready Tasks workflows (multi-tenant permissions, instrumentation, worker resiliency).
- Ensure portal/admin surfaces expose Tasks insights alongside billing + usage telemetry.
- Finalize operational playbooks (runbooks, load tests, rollback procedures) and customer-facing launch comms.

## Linked Plans
- Portal: `docs/meta/plans/portal/v0.1.4.md`
- Identity: `docs/meta/plans/identity/v0.1.4.md`
- Admin: `docs/meta/plans/admin/v0.1.4.md`
- Worker: `docs/meta/plans/worker/v0.1.4.md`
- Tasks App: `docs/meta/plans/tasks/v0.1.4.md`

## Milestones
| Week | Focus | Notes |
| --- | --- | --- |
| Nov – Week 3 | Sprint 1 | Harden Tasks app/worker pipelines, unblock onboarding flow, align permissions. |
| Nov – Week 4 | Sprint 2 | Execute cross-app load tests, finalize telemetry dashboards, prep rollout comms & support docs. |
| Dec – Week 1 (contingency) | Launch | Buffer for launch approvals, feature flag rollout, and incident response dry run. |

## Workstreams
1. **Tasks Product Hardening**
   - Close outstanding Tasks UI/UX bugs, improve empty/edge states.
   - Double-check entitlement enforcement per tenant/product boundary.
   - Expand Vitest + Playwright coverage for critical flows.
2. **Identity & Permissions**
   - Validate new scopes/claims powering Tasks API routes.
   - Ensure impersonation, audit logs, and org-switching behave with Tasks roles.
   - Confirm cross-app client updates published (`@ma/identity-client`, `@ma/contracts`).
3. **Admin/Support Experience**
   - Add Tasks context to admin dashboards (usage, queue health, customer escalations).
   - Document operational runbooks for common recovery actions.
4. **Worker & Telemetry**
   - Benchmark queue throughput with Tasks workloads; tune concurrency/retention where needed.
   - Roll out dashboards and alerts (identity + worker) targeting Tasks KPIs.
5. **Documentation & Launch**
   - Author rollout checklist, customer comms templates, and internal FAQ.
   - Align with GTM/support for enablement scheduling.

## Load Test & CLI Checklist
- Reuse Billing load-test harness (`pnpm --filter @ma/worker billing:load-test`) for joint Tasks + billing validation.
- Add Tasks-specific scenarios (job creation cadence, cross-tenant bursts) to CLI documentation in `docs/operations/runbooks`.
- Capture metrics/graphs and archive under `/docs/meta/artifacts/tasks-v0.1.4/` (stub to be created).

## Dependencies
- Billing GA Hardening (v0.1.3) complete and telemetry stable.
- Feature flag scaffolding for Tasks in portal/admin/identity.
- Observability stack updates (dashboards, alert routing).

## Verification Checklist
- [ ] Feature flags + roles reviewed for Tasks end-user and internal personas.
- [ ] Cross-app load test executed (tasks + billing) with metrics archived.
- [ ] Runbooks updated (Tasks operations, incident response, backfill tooling).
- [ ] Telemetry dashboards and alerts live for Tasks queues + API.
- [ ] Launch comms pack approved (release notes, FAQs, enablement doc).
- [ ] Rollback plan documented and validated with platform team.

