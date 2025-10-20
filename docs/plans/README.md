# Release Plan Conventions

This directory captures the forward-looking plan for each application in the monorepo.  
Every app maintains a folder containing Markdown files named after the *next* semantic version that will ship.  
Each plan should be updated before any version bump lands in `package.json`.

## Workflow

1. **Draft** the upcoming release plan in `docs/plans/<app>/vX.Y.Z.md`.  
2. **Implement** the scoped work (code, migrations, docs, tests).  
3. **Bump** the package version to match the plan once the tasks are complete.  
4. **Archive** or keep the file updated for historical reference; create the next plan before further work begins.

Plans are intentionally concise—focus on goals, notable changes, dependencies, testing, and rollout notes.  
The AI assistants use these documents to understand context and ensure version numbers stay aligned with agreed scope.

