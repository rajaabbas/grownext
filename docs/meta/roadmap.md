# Roadmap (Epic-Centric)

This roadmap ties long-running initiatives to epics. Each epic links to detailed
per-application plans under `docs/meta/plans/`. Review daily and update status as
milestones land.

## Timeline Overview

### Early Foundation (Sep 2025 – Oct 2025)

| Week | Epic | Status | Notes |
| --- | --- | --- | --- |
| Sep – Week 1 | Foundation Sprint 1 (v0.1.0) | ✅ Complete | Repo bootstrap, shared package skeletons, Super Admin scaffold. |
| Sep – Week 2 | Foundation Sprint 2 (v0.1.0) | ✅ Complete | Identity core, queue setup, app scaffolds finalized. |
| Sep – Week 3 | [Operations & Impersonation (v0.1.1)](plans/epics/operations-epic-v0.1.1.md) – Sprint 1 | ✅ Complete | Bulk job queues, admin UX foundations. |
| Sep – Week 4 | Operations & Impersonation – Sprint 2 (v0.1.1) | ✅ Complete | Impersonation safeguards, telemetry, runbooks. |
| Oct – Week 1 | [Billing Enablement (v0.1.2)](plans/epics/billing-epic-v0.1.2.md) – Sprint 1 | ✅ Complete | Billing schema/contracts, portal/admin integration groundwork. |
| Oct – Week 2 | Billing Enablement – Sprint 2 (v0.1.2) | ✅ Complete | Identity/admin billing APIs, worker processors. |
| Oct – Week 3 | Billing Enablement – Sprint 3 (v0.1.2) | ✅ Complete | Portal/admin UI, seed data, runbooks. |
| Oct – Week 4 | [Billing GA Hardening (v0.1.3)](plans/epics/billing-epic-v0.1.3.md) – Sprint 1 | ✅ Complete | Stripe hardening and UI polish shipped; platform readiness docs refreshed. |
| Oct – Final Week | Base Apps Hardening & Tasks GA Prep (v0.2.x–v0.3.x) | 🟢 In Progress | Condensed Oct 23–31 daily sprints driving security, stability, and UI polish across identity, portal, admin, and Tasks ahead of GA. |

### Daily Sprints (Oct 2025) – Base Apps → Tasks GA

| Date (Oct) | Version | Status | Focus |
| --- | --- | --- | --- |
| 23 | v0.2.0–v0.2.3 – Identity Hardening & Release Readiness | ✅ Complete | Auth lockdown, scaling drills, session resilience, smoke automation & runbooks. |
| 24 | v0.2.4–v0.2.7 – Portal Hardening & Onboarding | 🔜 Planned | Auth guardrails, UX/a11y polish, billing alignment, onboarding & docs updates. |
| 25 | v0.2.8–v0.2.11 – Admin Hardening & Release Readiness | 🔜 Planned | Permission audits, support tooling, reporting, disaster drills & release toggles. |
| 26 | v0.2.12–v0.2.13 – Cross-App Validation & Cutover Rehearsal | 🔜 Planned | Integrated staging QA, production rehearsal, comms plan, monitoring validation. |
| 27 | v0.3.0–v0.3.2 – Tasks Core & Collaboration | 🔜 Planned | Data model cleanup, lifecycle workflows, collaboration features, notifications. |
| 28 | v0.3.3–v0.3.4 – Tasks Productivity & Integrations | 🔜 Planned | Productivity tooling, reminders, calendar prep, identity/billing/admin wiring. |
| 29 | v0.3.5–v0.3.6 – Tasks Analytics, QA & Accessibility | 🔜 Planned | Analytics dashboards, RBAC widgets, accessibility audits, localization readiness. |
| 30 | v0.3.7–v0.3.9 – Tasks Performance & Launch Prep | 🔜 Planned | Consolidated performance validation, observability tuning, launch playbooks, release candidate & final regressions. |
| 31 | v1.0.0 – Tasks GA Launch | 🔜 Planned | Production rollout, monitoring war-room, post-launch analytics baseline. |

## Version Drilldown (Daily Sprints – Oct 23 – Oct 31, 2025)

Each date bundles multiple version drops; ensure all scoped work lands together. Every version must generate or update plan files for _all_ apps (`docs/meta/plans/{app}/vVERSION.md`) and include standard validation: unit tests, integration tests, Playwright E2E, lint/typecheck, accessibility checks, and release-notes updates. Unless specified otherwise, assume focus on identity, portal, admin, worker, tasks, and shared packages.

### Oct 23 – Identity Hardening & Release Readiness (v0.2.0–v0.2.3)
- **v0.2.0 – Identity Production Hardening 1**
  - **Planning:** Author v0.2.0 plan files for identity, portal, admin, worker, tasks capturing scope and acceptance criteria.
  - **Identity:** Enforce tenant-scoped API guards, audit JWT claim usage, add structured audit exports, tighten rate limiting defaults, document security posture gaps.
  - **Portal/Admin:** Validate identity permission boundary changes; update SDK integrations if headers change.
  - **Shared/Infra:** Update secrets rotation checklist; ensure `@ma/identity-client` exposes new enforcement helpers.
  - **Docs & QA:** Refresh runbooks with new auth guardrails; run regression/unit suites; record security review notes.
- **v0.2.1 – Identity Production Hardening 2**
  - **Planning:** Create v0.2.1 plan files for each app.
  - **Identity:** Implement horizontal scaling blueprint (autoscaling policies, connection pool tuning), add latency SLO dashboards, harden failover and throttling policies.
  - **Portal/Admin/Tasks:** Validate client timeouts against new SLOs; stage environment config updates.
  - **Shared:** Enhance `@ma/core` env typing for scaling knobs.
  - **Docs & QA:** Document scaling playbook; expand regression coverage; update synthetic monitoring scripts.
- **v0.2.2 – Identity Production Hardening 3**
  - **Planning:** Publish v0.2.2 plan files.
  - **Identity:** Harden session lifecycle (refresh logic, revocation propagation), ensure 2FA/SSO edge cases covered, simulate failovers.
  - **Portal/Admin:** Update authentication UIs for new session messaging; confirm impersonation flows unaffected.
  - **Worker:** Verify queue consumers handle auth token expiry gracefully.
  - **Docs & QA:** Update security FAQ; run SSO/2FA integration tests; capture failover drill results.
- **v0.2.3 – Identity Release Readiness**
  - **Planning:** Create v0.2.3 plan files.
  - **Identity:** Build automated smoke pipeline for deployments, implement feature flag rollback automation, finalize incident response checklist.
  - **Portal/Admin:** Integrate smoke hooks into CI for gateway flows.
  - **Shared:** Align versioning in contracts/client packages.
  - **Docs & QA:** Draft release notes, publish runbook updates, execute full regression (unit/integration/E2E/accessibility).

### Oct 24 – Portal Hardening & Onboarding (v0.2.4–v0.2.7)
- **v0.2.4 – Portal Production Hardening 1**
  - **Planning:** Create v0.2.4 plan files per app.
  - **Portal:** Strengthen auth guards, error boundaries, and feature-flagged navigation; implement offline/resume safeguards.
  - **Identity/Admin:** Ensure new portal error flows surface correctly; adjust APIs where necessary.
  - **Shared:** Add reusable error presentation components in `@ma/ui`.
  - **Docs & QA:** Update portal ops runbook, run portal-focused Playwright suite and Lighthouse checks.
- **v0.2.5 – Portal Production Hardening 2**
  - **Planning:** Create v0.2.5 plan files.
  - **Portal:** Polish UX (loading states, skeletons, localization scaffolding), ensure responsive layouts for key screens, audit accessibility (WCAG AA).
  - **Admin/Tasks:** Validate shared components compatibility.
  - **Docs & QA:** Document accessibility outcomes; rerun accessibility/E2E suites; update design tokens documentation.
- **v0.2.6 – Portal Billing & Usage Alignment**
  - **Planning:** Create v0.2.6 plan files.
  - **Portal:** Final QA for billing widgets, integrate usage analytics, ensure cross-app deep links, improve empty-state copy.
  - **Identity:** Verify API responses for new portal filters; add telemetry events.
  - **Admin:** Confirm billing insights align with portal displays.
  - **Docs & QA:** Update customer-facing billing guide; run billing E2E flows; refresh analytics dashboards.
- **v0.2.7 – Portal Onboarding & Docs**
  - **Planning:** Create v0.2.7 plan files.
  - **Portal:** Build guided onboarding wizard, contextual help, support doc linking, and notification prompts.
  - **Identity/Admin:** Provide necessary APIs for onboarding state; update permission gating.
  - **Docs & QA:** Ship onboarding documentation, record walkthrough video, run onboarding E2E scenarios, update release notes.

### Oct 25 – Admin Hardening & Release Readiness (v0.2.8–v0.2.11)
- **v0.2.8 – Admin Production Hardening 1**
  - **Planning:** Create v0.2.8 plan files.
  - **Admin:** Audit permission matrix, tighten role-based visibility, ensure impersonation guardrails, implement granular logging.
  - **Identity:** Support additional audit data fields; sync contract changes.
  - **Portal:** Validate shared role definitions remain consistent.
  - **Docs & QA:** Update admin runbooks; run admin-focused Playwright suite; produce SBOM updates if dependencies change.
- **v0.2.9 – Admin Production Hardening 2**
  - **Planning:** Create v0.2.9 plan files.
  - **Admin:** Expand support tooling (credit issuance automation, queue control panels), add escalation workflows, build views for worker health.
  - **Worker:** Expose metrics required by admin dashboards.
  - **Docs & QA:** Document escalation playbooks; run integration tests across admin + worker; update CLI help.
- **v0.2.10 – Admin Insights & Reporting**
  - **Planning:** Create v0.2.10 plan files.
  - **Admin:** Build finance dashboards, export automation, anomaly alert routing; ensure billing data freshness.
  - **Identity:** Provide bulk data endpoints optimized for reporting.
  - **Portal:** Validate crosslinks to admin reports for authorized users.
  - **Docs & QA:** Update analytics documentation; run data export regression tests; verify alert webhooks.
- **v0.2.11 – Admin Release Readiness**
  - **Planning:** Create v0.2.11 plan files.
  - **Admin:** Conduct disaster recovery drills, ensure feature flag coverage, stabilize admin E2E suites, finalize release toggles.
  - **Identity/Worker:** Confirm dependencies for admin failover.
  - **Docs & QA:** Compile release sign-off checklist; run full regression with focus on admin-critical paths; update release notes.

### Oct 26 – Cross-App Validation & Cutover Rehearsal (v0.2.12–v0.2.13)
- **v0.2.12 – Cross-App Staging Sign-off**
  - **Planning:** Create v0.2.12 plan files.
  - **Identity/Portal/Admin/Worker:** Execute integrated staging test matrix, verify cross-app notifications, ensure shared component parity.
  - **Tasks (prep):** Validate existing integrations for upcoming GA track.
  - **Docs & QA:** Produce staging certification report; run end-to-end suite across all apps; capture issues for backlog.
- **v0.2.13 – Production Cutover Rehearsal**
  - **Planning:** Create v0.2.13 plan files.
  - **All Apps:** Perform dry-run deploy across environment tiers, validate monitoring/alerting, rehearse communication plan, finalize handoffs.
  - **Infrastructure:** Review backup/restore procedures, ensure observability throttles tuned.
  - **Docs & QA:** Document rehearsal results, update launch runbooks, rerun smoke suites immediately post-rehearsal.

### Oct 27 – Tasks Core & Collaboration (v0.3.0–v0.3.2)
- **v0.3.0 – Tasks GA Track 1**
  - **Planning:** Create v0.3.0 plan files.
  - **Tasks:** Clean up data model, refactor board/list views, ensure baseline UX and performance.
  - **Identity:** Verify Tasks entitlements and scopes; update token claims.
  - **Portal/Admin:** Prepare surfaces for Tasks visibility, update navigation if necessary.
  - **Docs & QA:** Draft new Tasks overview docs; run existing Tasks tests; capture initial UX feedback.
- **v0.3.1 – Tasks GA Track 2**
  - **Planning:** Create v0.3.1 plan files.
  - **Tasks:** Implement task lifecycle features (create/assign/status workflow), subtasks, bulk operations.
  - **Identity:** Ensure API endpoints handle new lifecycle actions.
  - **Worker:** Wire queue processors for bulk operations.
  - **Docs & QA:** Update API references; run lifecycle-focused Playwright tests; add unit coverage for new flows.
- **v0.3.2 – Tasks Collaboration**
  - **Planning:** Create v0.3.2 plan files.
  - **Tasks:** Add comments, mentions, real-time sync; integrate notifications pipeline.
  - **Identity/Portal:** Ensure user presence data accessible; update notification preferences UI.
  - **Worker:** Configure WebSocket/broadcast infrastructure.
  - **Docs & QA:** Document collaboration features; verify notification delivery end-to-end; capture bug reports for follow-up fixes.

### Oct 28 – Tasks Productivity & Integrations (v0.3.3–v0.3.4)
- **v0.3.3 – Tasks Productivity Enhancements**
  - **Planning:** Create v0.3.3 plan files.
  - **Tasks:** Add due dates, reminders, recurring tasks; prepare calendar integration scaffolding.
  - **Portal:** Surface upcoming tasks summary widgets.
  - **Identity:** Extend usage emitters for new actions.
  - **Docs & QA:** Update productivity guides; run scheduled job tests; ensure reminders adhere to timezone requirements.
- **v0.3.4 – Tasks Integrations**
  - **Planning:** Create v0.3.4 plan files.
  - **Tasks:** Integrate with identity permissions, billing usage emitters, admin insights; ensure multi-tenant safeguards.
  - **Admin:** Display Tasks usage metrics; update support tooling.
  - **Worker:** Process Tasks billing events; ensure queue prioritization.
  - **Docs & QA:** Document integration architecture; run cross-app E2E; update SLAs.

### Oct 29 – Tasks Analytics, QA & Accessibility (v0.3.5–v0.3.6)
- **v0.3.5 – Tasks Analytics & Insights**
  - **Planning:** Create v0.3.5 plan files.
  - **Tasks:** Build workspace dashboards, workload heatmaps, KPI tracking.
  - **Portal/Admin:** Surface analytics widgets; ensure RBAC.
  - **Identity:** Provide aggregated analytics endpoints.
  - **Docs & QA:** Update analytics docs; run data validation tests; ensure performance on large tenants.
- **v0.3.6 – Tasks QA & Accessibility**
  - **Planning:** Create v0.3.6 plan files.
  - **Tasks:** Conduct comprehensive UX audit, fix accessibility violations, ensure localization hooks ready.
  - **Portal/Admin:** Validate tasks-related components for accessibility compliance.
  - **Docs & QA:** Produce QA sign-off report; run accessibility tooling; expand localization coverage.

### Oct 30 – Tasks Performance & Launch Prep (v0.3.7–v0.3.9)
- **v0.3.7 – Tasks Performance & Observability**
  - **Planning:** Create v0.3.7 plan files.
  - **Tasks:** Execute load testing, implement tracing, tune scaling automation, define error budgets.
  - **Worker:** Optimize background processors for throughput.
  - **Identity:** Ensure observability events are emitted for Tasks actions.
  - **Docs & QA:** Update observability runbooks; capture performance metrics; rerun stress suites.
- **v0.3.8 – Tasks Launch Playbook**
  - **Planning:** Create v0.3.8 plan files.
  - **Tasks & Cross-App:** Author launch runbooks, support FAQs, GTM collateral, finalize feature flag strategy.
  - **Portal/Admin:** Align messaging and in-app announcements.
  - **Docs & QA:** Compile launch checklist; rehearse customer support scenarios; ensure documentation published.
- **v0.3.9 – Tasks Production Cutover Prep**
  - **Planning:** Create v0.3.9 plan files.
  - **Tasks:** Execute final bug scrub, prepare release candidate build, secure staging sign-off.
  - **All Apps:** Validate interop with release candidate, freeze non-critical changes.
  - **Docs & QA:** Finalize release notes, run final regression + smoke suites, confirm rollback plan.

### Oct 31 – Tasks GA Launch (v1.0.0)
- **v1.0.0 – Tasks GA Launch**
  - **Planning:** Create v1.0.0 plan files summarizing GA deliverables and post-launch follow-up.
  - **Tasks:** Perform production rollout, monitor metrics, staff war-room, triage real-time feedback.
  - **All Apps:** Confirm integrations stable, monitor alerts, capture post-launch analytics baseline.
  - **Docs & QA:** Publish GA announcement, compile launch report, schedule postmortem/retrospective.

## Epic Backlog

### Completed
- **v0.1.3 – Billing GA Hardening** (`docs/meta/plans/epics/billing-epic-v0.1.3.md`): Stripe resiliency, shared billing UI, and verification close-out delivered. The load-test harness is ready and will be exercised during the consolidated Oct 30 performance window.

### In Flight · Oct 23 – 26 Daily Sprints
- **v0.2.x – Base Apps Production Hardening**: Identity, portal, and admin releases reach production-grade reliability through condensed drops emphasizing security, stability, and UI quality.
  - Identity (v0.2.0–v0.2.3 · Oct 23): security posture, scalability, rollback tooling, incident readiness.
  - Portal (v0.2.4–v0.2.7 · Oct 24): UX polish, onboarding, billing telemetry alignment, accessibility fixes.
  - Admin (v0.2.8–v0.2.11 · Oct 25): permission audits, support tooling, reporting enhancements, ops drills.
  - Cross-App (v0.2.12–v0.2.13 · Oct 26): integrated staging sign-off, production rehearsal, monitoring solidification.

### Upcoming · Oct 27 – 31 Daily Sprints
- **v0.3.x – Tasks GA Launch**: Condensed v0.3.x releases culminating in Tasks v1.0.0 GA with end-of-month performance validation shared across apps.
  - Product experience & collaboration (v0.3.0–v0.3.3 · Oct 27–28).
  - Integrations, analytics, and telemetry (v0.3.4–v0.3.7 · Oct 28–30).
  - Launch readiness, documentation, rollout, and end-of-month performance validation (v0.3.8–v1.0.0 · Oct 30–31).
- **v0.1.4 – Tasks Launch Readiness Support** (`docs/meta/plans/epics/tasks-launch-epic-v0.1.4.md`): Parallel effort to finalize multi-tenant permissions, job telemetry, onboarding flows, GTM materials, and shared support docs. Staging scenarios across identity/portal/tasks/worker will feed into the Oct 30 consolidated validation.

### Future Candidates
- Observability & Reliability Epic – SLOs, centralized logging, automated incident response.
- Monetization Expansion Epic – Self-serve provisioning, tier packaging, CRM integrations.
- Compliance & Data Lifecycle Epic – Audit retention, privacy tooling, regional deployments.
- Public API & Mobile SDK Epic – REST/GraphQL surface, auth flows, client SDKs.
- Developer Experience Epic – Turbo generators, Storybook/design system, internal portal.
- Additional Product Apps – Expand platform with first-party apps powered by identity client.

## Using This Roadmap
- When starting a new epic, create `docs/meta/plans/epics/<name>-epic-vX.Y.Z.md` and link per-app plans.
- Keep the timeline table up to date with target windows and status.
- As epics wrap, move them to “Complete” and roll forward the next set of initiatives.
