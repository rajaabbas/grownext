# @ma/contracts

Shared Zod schemas and OpenAPI fragments that define identity and product HTTP
contracts. Published as a versioned SDK consumed by portal, worker, and product
apps.

## Commands

```bash
pnpm --filter @ma/contracts build
```

This compiles schemas to `dist/` for downstream use. Release steps live in
`docs/operations/sdk-release.md`.
