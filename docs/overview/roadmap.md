# Roadmap & Future Enhancements

This backlog captures medium- and long-term initiatives that can evolve GrowNext from a starter kit into a production-scale multi-product platform. Prioritize the items that align with customer demand, compliance requirements, and organizational capacity—then update this document as milestones land.

## Platform Hardening

- **Operational SLOs & Incident Automation** – Define latency/error budgets for identity, portal, and product APIs. Feed metrics into alerting and create automated playbooks for auth failures, queue backlogs, and Supabase outages.
- **Observability & Alerting** – Stream structured logs to centralized tooling (e.g., Datadog, Honeycomb, Grafana Loki) and expose dashboards for auth success rates, queue latency, and Supabase error codes. Wire alerts for SLO burn rates and Redis health.
- **High Availability & Disaster Recovery** – Plan multi-region failover: managed Postgres replicas, Redis clustering, Supabase backup strategy, and documented recovery runbooks.

## Monetization & Access Control

- **Billing Integration** – Replace seed entitlements with live billing events (Stripe/Chargebee). Sync subscription changes into `ProductEntitlement` and emit audit trails for compliance.
- **Self-Serve Tenant Provisioning** – Extend portal onboarding so customers can create tenants, choose bundles, and invite teammates without manual steps. Optionally integrate CRM/webhook flows for sales-led deals.

## Product Surface Expansion

- **Additional First-Party Apps** – Build new product experiences (e.g., Calendar, CRM) that consume identity solely through `@ma/identity-client` and HTTP endpoints to validate service boundaries.
- **Public APIs & Mobile** – Publish identity-backed REST/GraphQL endpoints and mobile SDKs that reuse the same entitlement model.
- **Task Automation Enhancements** – Add SLA dashboards, recurring tasks, and webhook notifications. Evaluate streaming queues if BullMQ throughput becomes a bottleneck.

## Compliance & Data Lifecycle

- **Audit Log Retention & Export** – Persist audit events long term (S3/data lake) and expose tenant-level export APIs for SOC 2/GDPR.
- **Data Residency & Privacy Controls** – Support region-specific storage, deletion workflows (right-to-be-forgotten), and tenant isolation for regulated customers.
- **Security Hardening** – Move JWT signing to RS256 with managed keys (AWS/GCP KMS), add CSP/WAF layers, run periodic penetration tests.

## Developer Experience

- **Scaffolding & Generators** – Provide turbo generators or CLIs for new product apps, shared contracts, and job queues to keep architecture consistent.
- **Testing Framework Expansion** – Add integration suites with containerized Supabase/Redis, plus smoke tests covering SAML/OIDC flows in staging.
- **Developer Portal** – Produce API references, Storybook for `@ma/ui`, and onboarding tutorials for internal feature teams.

> Use this roadmap alongside the deployment guide and operational runbooks. When an initiative ships, either remove it or link to the implementation notes so future contributors have historical context.
