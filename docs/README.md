# GrowNext Platform Documentation

This directory aggregates architecture references, onboarding guides, and contribution standards for the multi-product platform.

## Structure

- `architecture.md` – identity, portal, product interactions, and optional SAML federation
- `onboarding.md` – local environment setup, Supabase configuration, and daily workflows
- `contributing.md` – branching strategy, CI expectations, and migration guidance
- `Agents.md` – automation guardrails and service boundaries between identity and product apps
- `production-readiness.md` – checklist for rolling the stack out to Render (or any managed host)
- `releases.md` – process for publishing the SDK packages (`@ma/contracts`, `@ma/identity-client`)
- `roadmap.md` – backlog of future enhancements and platform hardening initiatives
- `tasks-db-split.md` – historical notes on separating product storage from identity data

📎 Diagrams and request flow tables live alongside these guides; update them whenever you evolve the architecture.
