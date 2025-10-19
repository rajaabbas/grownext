# Incident Response Playbook

Use this checklist when responding to production issues across identity, portal, tasks, or worker services. Adapt it to your incident management tooling and rotation.

## 1. Triage

1. Acknowledge the alert within your on-call window.
2. Capture high-level context:
   - Which service(s) are affected?
   - What metrics or customer reports triggered the incident?
   - Is there an obvious change (deployment, config update) correlating with the onset?

## 2. Stabilize

| Symptom | Immediate Actions |
| --- | --- |
| Authentication failures | Check identity `/health`, Supabase status, Redis connectivity. Roll back recent identity deployments if necessary. |
| Portal outages | Verify Supabase env keys, identity reachability, and Next.js error logs. Redirect traffic to maintenance page if downtime is prolonged. |
| Queue backlog | Scale worker horizontally, inspect stuck jobs, confirm Redis memory and connection counts. |
| Database pressure | Inspect Postgres metrics (connections, locks, slow queries). Scale vertically or limit new writes; if migrations just ran, investigate long-running DDL. |

If customer impact is severe, consider feature flags or temporary throttling (e.g., disable new tenant creation) while you investigate.

## 3. Diagnose

1. Collect logs and traces for the failing paths.
2. Review recent deployments, migrations, and queued jobs.
3. Reproduce locally or in staging if possible.
4. Engage domain owners (identity, portal, tasks, infrastructure) when the issue spans multiple services.

## 4. Resolve

- Apply targeted fixes (config adjustment, hotfix deploy, queue drain).
- Validate using automated checks (`pnpm test`, end-to-end smoke tests) and manual spot checks.
- Monitor metrics until they return to baseline.

## 5. Communicate

- Provide periodic updates to stakeholders (status page, internal channels).
- Document customer-facing impact, mitigation steps, and follow-up actions.

## 6. Post-Incident Review

- Schedule a retro with involved teams.
- Capture root cause, contributing factors, and action items.
- Update runbooks, monitoring, and tests to prevent recurrence.
- If documentation gaps contributed to the incident, patch them immediately (this playbook is a good place).

> Keep this playbook accessible (linked from on-call rotation docs) and iterate after each incident. The goal is fast mitigation, clear communication, and long-term prevention.
