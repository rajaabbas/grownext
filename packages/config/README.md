# Config Package

Centralized lint, TypeScript, Vitest, and formatting configuration shared across the monorepo. Extend these presets from individual apps or packages to keep tooling consistent.

## Contents

- TypeScript base configs for Node, React, and Vitest
- Shared ESLint rules and import resolvers
- Prettier configuration and formatting conventions

## Usage

```json
{
  "extends": "@ma/config/tsconfig.react.json"
}
```
