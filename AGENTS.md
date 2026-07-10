# Track repository guide

Track is a pnpm monorepo for a project-memory application. The web client and
mobile client share domain contracts, while Convex owns persistence and backend
functions.

## Repository map

- `apps/web`: TanStack Start web application.
- `apps/mobile`: Expo mobile application.
- `packages/shared`: framework-independent domain helpers and contracts.
- `convex`: schema, queries, mutations, actions, and backend tests.
- `docs`: current product, architecture, design, and roadmap documentation.

## Local setup

Use Node 24 and pnpm. Copy `.env.example` to `.env.local`, then provide a
development Convex deployment and the authentication values described in the
template.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The web application runs on `http://localhost:3000`. Keep development services
bound to localhost.

## Required verification

Run the complete gate before handing off a change:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

Load the affected application locally after the automated gate passes. Verify
the changed route or workflow and check the browser console for errors.

Never remove, skip, or weaken a failing test to make the gate pass. Fix the
failure or report the exact blocker.

## Change boundaries

- Preserve unrelated work in a dirty worktree.
- Keep shared domain contracts in `packages/shared` free of framework imports.
- Keep Convex schema and generated API declarations aligned with backend code.
- Regenerate the TanStack route tree when routes change.
- Update current documentation when product behavior or architecture changes.
- Put future product work in `docs/ROADMAP.md`; do not describe it as shipped.
- Do not deploy or access production systems without explicit approval.
- Do not commit secrets, local environment files, generated build output, or
  scratchpad session logs.

## Product boundary

Track currently centers on projects, group conversations, evidence,
attachments, search, assistant responses, and durable project memory. Records,
Draft Records, AI review queues, and record exports are outside the product
model. Do not reintroduce those concepts without an approved product decision.
