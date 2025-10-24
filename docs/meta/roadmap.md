# Roadmap (Epic-Centric)

This roadmap focuses on the minimum work required to ship our GA-ready experience while deferring nice-to-haves to post-launch epics. Each active version has an associated plan file for every affected app under `docs/meta/plans/{app}/vVERSION.md`.

## Timeline Overview

| Phase | Dates | Version(s) | Status | Notes |
| --- | --- | --- | --- | --- |
| Early Foundation | Sep 2025 – Oct 2025 (Weeks 1‑4) | v0.1.0–v0.1.3 | ✅ Complete | Repo/bootstrap, identity & queue scaffolds, impersonation tooling, initial billing enablement. |
| Base Apps Hardening | Oct 23 2025 | v0.2.0 | ✅ Complete | Identity guardrails, portal/admin/worker/task updates, shared runbooks, smoke automation. |
| GA Readiness | Oct 24 – 28 2025 | v0.2.1–v0.2.4 | 🟢 In Progress | Portal/admin polish, cross-app QA, manual sign-off, Tasks MVP launch prep. |
| Post-Launch Enhancements | Nov 2025+ | v0.3.x+ | 📬 Scheduled | Productivity features, deep analytics, performance tuning, GTM collateral. |

## Active Track – GA Readiness (Oct 24 – 27 2025)

These versions close out launch-critical gaps. For each entry, ensure plan files exist for every app touched (identity, portal, admin, tasks, worker).

### v0.2.1 – Portal / Admin Finishing Pass
- **Planning:** Update plan files: `identity`, `portal`, `admin`, `worker`, `tasks`.
- **Portal:** Finalize auth guardrails UX, ensure onboarding & billing pages surface new throttling copy, verify Playwright smoke coverage.
- **Admin:** Tighten impersonation & bulk-job messaging, confirm support runbook updates land, harden role-management flows.
- **Identity/Worker:** No new features—just regression checks for the guardrail changes already shipped in v0.2.0.
- **Docs & QA:** Refresh onboarding/support docs, run portal/admin smoke, capture known issues for launch notes.

### v0.2.2 – Cross-App QA & Cutover Rehearsal
- **Planning:** Extend plan files for `identity`, `portal`, `admin`, `tasks`, `worker`.
- **Cross-App QA:** Execute integrated staging run (login → impersonation → Tasks handoff), confirm monitoring dashboards wired.
- **Release Prep:** Draft launch-day runbook, dry-run rollback, verify alert routing.
- **Automation:** Ensure smoke suites (`pnpm --filter @ma/e2e run test:portal|admin|tasks`) run in CI.

### v0.2.3 – Manual Validation & Sign-off
- **Planning:** Create manual validation plan files (`identity`, `portal`, `admin`, `tasks`, `worker`) capturing owner, environment, and acceptance criteria.
- **Manual QA:** Product/QA reviewers browse critical user journeys (login, impersonation banners, billing flows, Tasks creation) and log issues in Linear.
- **Monitoring Review:** Spot-check dashboards/alerts in Grafana/PagerDuty, ensure runbooks reflect latest remediation paths.
- **Ops Drills:** Perform rollback rehearsal and confirm support handoffs (queue telemetry coordination, known-issues doc).
- **Output:** Manual sign-off checklist completed prior to GA change freeze.

### v0.2.4 – Tasks MVP Launch Scope
- **Planning:** Create MVP plan files for `tasks`, `portal`, `admin`, `identity`, `worker`.
- **Tasks:** Ship core lifecycle (create/assign/status), board/list views, comments/mentions, notifications, basic analytics emitters.
- **Portal/Admin:** Surface Tasks links, entitlement checks, minimal usage reporting.
- **Worker:** Ensure notification queues and Tasks billing emitters function.
- **Docs & QA:** Publish Tasks overview/runbook, update release notes, capture GA known issues.

## Post-Launch Epics (Deferred)

The following initiatives stay in the backlog until after GA. Create dedicated epics when we schedule them:

1. **Tasks Productivity & Integrations** – recurring tasks, reminders, calendar scaffolding, admin usage dashboards.
2. **Tasks Analytics & Insights** – workspace dashboards, workload heatmaps, extended RBAC widgets, large-tenant performance tuning.
3. **Tasks Accessibility & Localization** – comprehensive a11y audit, localization hooks, UX polish.
4. **Tasks Performance & Observability** – load tests, tracing, error budget workflows.
5. **Launch & GTM Enhancements** – marketing collateral, in-app announcements, customer success playbooks.

Focusing on the GA track keeps us lean: ship the hardened identity/control plane plus a solid Tasks MVP, then layer the advanced experiences once real usage validates the demand.
