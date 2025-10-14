# Database Package

Prisma client, migrations, and database helpers powering the identity and entitlement systems. Includes seed scripts for local development and shared query utilities.

## Responsibilities

- Maintain Prisma schema for organizations, tenants, products, entitlements, and audit events
- Generate type-safe Prisma client for API and worker usage
- Provide seeding utilities and Supabase policy helpers

## Development

```bash
pnpm dev --filter @ma/db
```

Use `pnpm db:migrate` from the repository root to apply migrations locally.
