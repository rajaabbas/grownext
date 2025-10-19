# Contracts Reference

Shared HTTP contracts and DTOs live in `@ma/contracts`. They are authored as Zod schemas and emitted as TypeScript types, enabling both runtime validation and compile-time safety across services.

## Package Layout

```
packages/contracts/
  src/
    auth/
    portal/
    tasks/
    ...
  dist/
    (compiled ESM output)
  tsconfig.build.json
```

Key exports include:

- `PortalLauncherResponse` – aggregate payload consumed by the portal launcher.
- `PortalPermission` enum – powers the permissions UI and identity APIs.
- `ProductEntitlementSchema` – entitlements exchanged between identity and product apps.
- `TasksContextResponse` – tenancy context returned by `/internal/tasks/context`.

## Usage Patterns

```ts
import { PortalLauncherResponseSchema } from "@ma/contracts";

const payload = await fetch(...).then((res) => res.json());
const launcher = PortalLauncherResponseSchema.parse(payload);
```

- Services should validate incoming/outgoing payloads using the Zod schemas.
- Frontends can rely on the inferred TypeScript types for autocomplete and type-checking.

## Regenerating Types

Contracts are plain TypeScript; run `pnpm --filter @ma/contracts build` to emit `dist/`. Publishing instructions live in [`../guides/sdk-release-guide.md`](../guides/sdk-release-guide.md).

## Extending the Contracts

1. Add a new schema under the appropriate domain (portal, tasks, identity, etc.).
2. Export it from `src/index.ts`.
3. Update consumers to use the new schema and run validation in unit tests.
4. Document the changes in the SDK changelog before publishing.

Keep this reference up to date as contracts evolve or new domains are added (e.g., additional product apps).
