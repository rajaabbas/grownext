# SDK Release Checklist

`@ma/contracts` and `@ma/identity-client` are the publishable SDKs in this repo.
Use this checklist to cut consistent releases.

## 1. Build artifacts

```bash
pnpm --filter @ma/contracts build
pnpm --filter @ma/identity-client build
```

The build uses `tsc --build`, flattens output, and ensures test-only files are
excluded from `dist/`.

## 2. Update changelogs

- Summarize highlights, breaking changes, and migration notes.
- Keep version numbers aligned with `package.json`.

## 3. Tag the repository

- Use semantic tags (e.g., `v0.4.2`) so CI and consumers can reference the release.
- Push the tag before publishing to avoid mismatched builds.

## 4. Publish

```bash
pnpm publish --filter @ma/contracts --access restricted
pnpm publish --filter @ma/identity-client --access restricted
```

Publish from a clean tree with build artifacts ready (or via a CI job that runs the
build step first).

## 5. Notify consumers

- Share changelog entries with app teams.
- Bump dependency ranges in consuming apps and run the relevant test suites
  (`pnpm test:identity`, `pnpm test:portal`, etc.) to confirm compatibility.
- Update release plans in `docs/meta/plans/<app>` if scope or timelines changed.

## Tips

- Automate version bumps and changelog checks with a release script or GitHub Action.
- Regenerate derived clients/OpenAPI docs whenever contracts change.
- Publish prereleases (`next`, `beta`) when experimenting with new endpoints or
  breaking changes.
