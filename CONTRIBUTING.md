# Contributing to Track

Track welcomes focused bug fixes, tests, documentation improvements, and product changes that match the current specifications.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue for changes that alter product semantics, permissions, data shape, or user-visible workflows.
3. Keep each pull request focused on one coherent outcome.
4. Never include credentials, deployment identifiers, personal data, session logs, crash reports, or store-submission artifacts.

## Development

Follow the setup in [README.md](./README.md). Match existing TypeScript and UI patterns, preserve access boundaries, and add regression coverage for changed behavior.

Run the full gate before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

## Pull requests

Describe the user-facing outcome, the verification performed, and any migration or configuration impact. Use Conventional Commit titles such as `fix(web): preserve group access on search` or `docs: clarify local Convex setup`.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
