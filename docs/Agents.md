# Agents Guide

This document captures the guardrails we expect every automation agent (including future Codex runs) to follow when working in the GrowNext repository.

## Identity ↔ Tasks Boundary

- The identity service (`apps/identity`) is the only place that may import or call helpers from `@ma/db`. Product applications such as the tasks app **must** communicate with identity exclusively through HTTP endpoints exposed by the identity service.
- Tasks data lives in the `@ma/tasks-db` schema. When a feature needs identity-derived information (e.g. owner display metadata), call the appropriate identity API with the end-user's access token.
- The identity service exposes `/internal/tasks/context` for tenancy resolution and `/internal/tasks/users` for resolving task owner details. Use the helpers from `@ma/identity-client` (`fetchTasksContext`, `fetchTasksUsers`) instead of reaching into identity storage directly.
- When adding new cross-service interactions, design an identity endpoint first, add or extend a helper in `@ma/identity-client`, and only then consume it from the product app. Update this guide if additional endpoints become part of the contract.

## Implementation Expectations

- Before shipping changes in the tasks app, scan for stray `@ma/db` imports. If any are required for a new capability, rework the feature behind an identity HTTP surface instead.
- Keep ownership lookups batched through identity endpoints to limit network chatter while preserving the service boundary.
- Extend the shared Zod contracts when introducing new payloads so that identity, the client SDK, and product apps share the same validation guarantees.

## Validation & Documentation

- Always run `pnpm --filter @ma/tasks typecheck` and `pnpm --filter @ma/tasks lint` after modifying tasks API codepaths, and mirror that with `pnpm --filter @ma/identity typecheck` and targeted identity tests when introducing new endpoints.
- When these rules force architectural shifts (e.g. new endpoints, shared helpers), make sure the root README and relevant docs mention the updated boundary so the next agent has immediate context.
