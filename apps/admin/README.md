# Super Admin App

The Super Admin app provides internal tooling for managing users, roles, impersonation, and audit trails across all GrowNext applications.

## Responsibilities

- Surface global user search, detail, and management workflows for internal teams.
- Expose cross-application roles, entitlements, and audit activity in a single console.
- Support privileged operations such as impersonation, bulk actions, and compliance reviews.

## Local Development

```bash
pnpm dev --filter @ma/admin
```

Run the identity service alongside the admin app to exercise authenticated APIs during development.
