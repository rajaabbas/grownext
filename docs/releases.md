# SDK Release Guide

The publishable packages in the monorepo are `@ma/contracts` and `@ma/identity-client`. Each ships pre-built ESM output under `dist/` and maintains human-written release notes in its `CHANGELOG.md`.

## Release Checklist

1. **Build the packages**
   ```bash
   pnpm --filter @ma/contracts build
   pnpm --filter @ma/identity-client build
   ```
   This runs `tsc --build`, flattens the emitted output, and guarantees no tests or internal helpers leak into `dist/`.
2. **Verify changelog entries** – Update the appropriate `CHANGELOG.md` with version numbers, highlights, and any migration notes.
3. **Tag the repo** – Use semantic versioning (`v0.x.y`) that matches the `package.json` version before publishing.
4. **Publish from CI or locally** – Run `pnpm publish --filter @ma/contracts --access restricted` (and the same for `@ma/identity-client`) from a clean git state with `pnpm build` artifacts present.
5. **Notify downstreams** – Reference the changelog entry in release notes so app teams can align their dependency ranges and re-run contract compatibility tests.

> Tip: Use `pnpm test:identity` and `pnpm test:tasks` after bumping the SDK versions to confirm the consuming services are still type-safe and green.
