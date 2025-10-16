# Contracts Package

Common domain contracts shared by the identity service, workers, and product apps. Contracts are defined with Zod schemas and emitted as OpenAPI fragments for HTTP services.

## Responsibilities

- Model request/response payloads for identity and product APIs
- Provide schema-driven validation helpers and type inference
- Generate OpenAPI documents for downstream integration

## Development

```bash
pnpm dev --filter @ma/contracts
```

Schemas live under `src/` and are compiled to `dist/` for consumption.

## Releases

Version history and compatibility notes are published in [`CHANGELOG.md`](./CHANGELOG.md). Keep dependent services on the same tagged version to guarantee contract stability.
