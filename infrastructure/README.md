# Infrastructure Manifests

Deployment manifests, Terraform modules, and Helm charts for the identity platform and product applications will live here. Environments are split between production, staging, preview, and local infrastructure-as-code modules.

## Planned Layout

- `identity/` – Fastify identity service deployment (container image, gateway configuration, secrets)
- `portal/` – Next.js portal deploy targets (Vercel, container fallback)
- `products/` – Per-product manifests for Social, Videos, Website, Design
- `worker/` – BullMQ worker process definitions and queue provisioning scripts

IaC definitions will be added in future iterations.
