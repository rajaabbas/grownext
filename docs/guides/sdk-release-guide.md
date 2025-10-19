# SDK Release Guide

The publishable packages in this monorepo are `@ma/contracts` and `@ma/identity-client`. Each ships pre-built ESM output in `dist/` and maintains a human-written `CHANGELOG.md`. Use this guide to cut consistent releases.

## Checklist

1. **Build the packages**

   ```bash
   pnpm --filter @ma/contracts build
   pnpm --filter @ma/identity-client build
   ```

   The build runs `tsc --build`, flattens the emitted output, and ensures no test-only files leak into `dist/`.

2. **Update changelogs**

   - Document highlights, breaking changes, and migration notes.
   - Keep version numbers aligned with `package.json`.

3. **Tag the repository**

   - Use semantic tags, e.g. `v0.4.2`.
   - Push the tag before publishing so CI/workflows can reference it.

4. **Publish**

   ```bash
   pnpm publish --filter @ma/contracts --access restricted
   pnpm publish --filter @ma/identity-client --access restricted
   ```

   Publish from a clean tree with build artifacts checked in (or run via CI job that builds prior to publish).

5. **Notify consumers**

   - Share the changelog entry with app teams.
   - Bump dependency ranges in consuming apps and run `pnpm test:identity`, `pnpm test:tasks`, etc. to confirm compatibility.

## Tips

- Automate version bumps and changelog validation with a release script or GitHub Action.
- If the contracts change, ensure downstream services regenerate any derived clients or OpenAPI docs.
- Consider publishing pre-releases (`next`, `beta`) when experimenting with new endpoints.
