# GrowNext Platform

GrowNext is a multi-product SaaS starter: a Supabase-backed identity service, a
tenant-aware portal, opinionated product scaffolding, and shared TypeScript SDKs.

## Quick start

```bash
pnpm install
docker compose up supabase -d
pnpm seed
pnpm dev
```

Visit `http://localhost:3200` to sign up, create an organization, and launch the
sample Tasks app; the Super Admin console runs at `http://localhost:3500` by
default. Local setup details live in `docs/setup/local-development.md`.

## Documentation

- Setup guides: `docs/setup/`
- Architecture overview: `docs/architecture/overview.md`
- Runbooks & playbooks: `docs/operations/`
- Environment reference: `docs/reference/`
- Process & release plans: `docs/meta/`

Keep README entries short—add deeper guidance to the docs so every workspace shares
the same authoritative references.
