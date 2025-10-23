# Plans Directory

Release plans are grouped by owning application so that each feature ships with the
next version of the app that exposes it. When adding or updating plans, follow
these conventions:

- `portal/`, `admin/`, `identity/`, `worker/`, etc. contain versioned plans for each
  service or frontend. File names follow the pattern `vX.Y.Z.md` and represent the
  authoritative backlog for that app release.
- Cross-cutting initiatives live under `epics/` (for example,
  `epics/billing-epic-v0.1.3.md`). Each epic should provide goals, timeline, rollout
  checklist, and links to the per-application plans that deliver the work.
- When a feature spans multiple apps:
  1. Create or update the epic document with the feature overview and status.
  2. Update every affected app plan with the concrete tasks and reference the epic
     near the top of the file.
  3. Mirror the epic in `docs/meta/releases/` when drafting release notes so the
     cross-app summary stays in sync with individual app changelogs.
- Do not introduce module-specific folders; add new epics and keep all
  implementation detail inside the existing app directories.

## Current Epics

- `epics/foundation-epic-v0.1.0.md`
- `epics/operations-epic-v0.1.1.md`
- `epics/billing-epic-v0.1.2.md`
- `epics/billing-epic-v0.1.3.md`
