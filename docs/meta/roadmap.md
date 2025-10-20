# Roadmap & Future Enhancements

This backlog tracks medium- and long-term initiatives that evolve GrowNext from a
starter kit into a production-grade multi-product platform. Revisit it quarterly,
prioritize items that align with customer demand and compliance commitments, and
update entries once milestones land.

## Platform Hardening

- **Operational SLOs & Incident Automation** – Define latency/error budgets for
  identity, portal, and product APIs. Feed metrics into alerting and automate
  playbooks for auth failures, queue backlogs, and Supabase outages.
- **Observability & Alerting** – Centralize logs (Datadog, Honeycomb, Grafana Loki),
  expose dashboards for auth success rates, queue latency, Supabase error codes,
  and set alerts for SLO burn rates and Redis health.
- **High Availability & Disaster Recovery** – Plan multi-region failover: managed
  Postgres replicas, Redis clustering, Supabase backup strategy, and documented
  recovery runbooks.

## Monetization & Access Control

- **Billing Integration** – Replace seed entitlements with billing events
  (Stripe/Chargebee). Sync subscription changes into `ProductEntitlement` and emit
  audit trails.
- **Self-Serve Tenant Provisioning** – Extend portal onboarding so customers can
  create tenants, pick bundles, and invite teammates without manual steps. Integrate
  CRM/webhooks for sales-led deals.

## Product Surface Expansion

- **Additional First-Party Apps** – Build new product experiences that use identity
  solely through `@ma/identity-client` and HTTP endpoints.
- **Public APIs & Mobile** – Publish identity-backed REST/GraphQL endpoints and
  mobile SDKs that reuse entitlement checks.
- **Task Automation Enhancements** – Add SLA dashboards, recurring tasks, webhook
  notifications, and evaluate streaming queues if BullMQ throughput becomes a
  bottleneck.

## Compliance & Data Lifecycle

- **Audit Log Retention & Export** – Persist audit events long term (S3/data lake)
  and expose tenant-level exports for SOC 2/GDPR.
- **Data Residency & Privacy Controls** – Support regional storage, deletion
  workflows (right-to-be-forgotten), and tenant isolation for regulated customers.
- **Security Hardening** – Move JWT signing to managed KMS, add CSP/WAF layers, run
  regular penetration tests.

## Developer Experience

- **Scaffolding & Generators** – Provide turbo generators or CLIs for new product
  apps, contracts, and queue jobs to maintain architectural consistency.
- **Testing Framework Expansion** – Add integration suites with containerized
  Supabase/Redis plus smoke tests covering SAML/OIDC flows in staging.
- **Developer Portal** – Publish API references, Storybook for `@ma/ui`, and
  onboarding tutorials for internal feature teams.

Use this roadmap alongside deployment guides and operational runbooks. When an
initiative ships, note the implementation or remove the entry so the list reflects
current priorities.
