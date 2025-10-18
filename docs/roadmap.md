# Roadmap & Future Enhancements

This document captures medium- and long-term initiatives that extend the GrowNext starter into a production-scale multi-product platform. Use it as a planning backlog; adjust priorities as your customer and compliance requirements evolve.

## Platform Hardening

- **Operational SLOs & Incident Automation**  
  Define service-level objectives (latency, error budgets) across identity, portal, and product APIs. Feed real-time metrics into centralized rate limiting, anomaly detection, and automated playbooks so on-call engineers can mitigate spikes (e.g., auth failures, queue backlogs) quickly.

- **Observability & Alerting**  
  Ship structured logs to a log aggregation pipeline (Datadog, Honeycomb, Grafana Loki) and expose key dashboards (auth success rate, queue latency, Supabase error codes). Configure alerts for SLO burn rates, Redis health, and background job retries.

- **High Availability & Disaster Recovery**  
  Plan for multi-region failover. Replicate Postgres and Redis (managed offerings or cross-region replicas), test Supabase outage responses, and document recovery runbooks.

## Monetization & Access Control

- **Billing & Licensing Integration**  
  Replace seed-based entitlements with a billing engine. Sync subscription events (upgrade, downgrade, cancellation) from Stripe/Chargebee (or your billing layer) into the `ProductEntitlement` model and emit audit trails for compliance.

- **Self-serve Tenant Provisioning**  
  Extend portal onboarding so customers can create tenants, pick product bundles, and invite team members without manual intervention. Optionally integrate with CRM/webhooks for sales-led flows.

## Product Surface Expansion

- **Additional First-party Apps**  
  Build new product experiences (e.g., Calendar, CRM) that consume identity strictly through `@ma/identity-client` and the `/internal/*` APIs. Use them to validate the service boundary and sharpen patterns for tenant-aware product development.

- **Mobile & Public APIs**  
  Publish identity-backed REST/GraphQL endpoints and mobile SDKs so third-party integrations can access the platform under the same entitlement rules.

- **Task Automation Enhancements**  
  Add SLA dashboards, recurring tasks, and webhook notifications. Evaluate streaming queues (Kafka/NATS) if BullMQ throughput becomes a bottleneck.

## Compliance & Data Lifecycle

- **Audit Log Retention & Export**  
  Persist audit events long-term (S3/data lake) and provide tenant-level export APIs to satisfy SOC 2/GDPR requests. Include product mutations (tasks CRUD, permissions changes) alongside identity events.

- **Data Residency & Privacy Controls**  
  Introduce region-specific storage and deletion workflows (right-to-be-forgotten automation, tenant data isolation) for regulated customers.

- **Security Hardening**  
  Migrate token signing to RS256 with managed keys (AWS KMS, GCP KMS), add Web Application Firewall (WAF) rules, enforce Content Security Policy (CSP), and run periodic penetration tests.

## Developer Experience

- **Scaffolding & Generators**  
  Provide turbo generators/CLI scripts for new product apps, shared contracts, and background jobs to keep architecture consistent.

- **Testing Framework Expansion**  
  Add integration suites that spin up Supabase/Redis with test containers, plus smoke tests that exercise SAML/OIDC flows against staging infrastructure.

- **Developer Portal**  
  Create documentation tooling (Storybook for `@ma/ui`, API reference for identity endpoints) so internal teams can build features rapidly and safely.

---

Treat this roadmap as a living document—update it whenever you triage customer requests, compliance needs, or infrastructure gaps. For immediate deployment-readiness tasks, continue referencing [`production-readiness.md`](./production-readiness.md).
