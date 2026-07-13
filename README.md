# Track

Track is a project collaboration workspace where client and vendor teams work in group conversations, retain references, and use permission-aware AI assistance. The web and mobile apps support realtime chat, attachments, voice notes, notifications, `@track` answers, project memory imports, search, and audit history.

First-class task management and Kanban boards are the next major product direction in [docs/ROADMAP.md](./docs/ROADMAP.md).

## Repository

```text
apps/web/          TanStack Start web app and PWA
apps/mobile/       Expo Router native app
packages/shared/   Shared domain rules and theme primitives
convex/            Schema, authorization, functions, jobs, AI, and tests
docs/              Maintained product and engineering context
assets/brand/svg/  Final brand masters
```

Read [AGENTS.md](./AGENTS.md) before changing the repository. The maintained documentation is:

- [Product](./docs/PRODUCT.md): current behavior, roles, and access invariants.
- [Architecture](./docs/ARCHITECTURE.md): stack, boundaries, and data flow.
- [Design](./docs/DESIGN.md): interface, tokens, interaction states, and accessibility.
- [Roadmap](./docs/ROADMAP.md): agreed behavior that has not shipped.
- [Task management specification](./docs/TASK_MANAGEMENT_SPEC.md): approved future task, board, chat, AI, access, and delivery contract.
- [Company relationships specification](./docs/COMPANY_RELATIONSHIPS_SPEC.md): approved future company, relationship, shared-project, channel, access, and migration contract.

## Requirements

- Node.js 24 or newer.
- pnpm 10.19.0 through Corepack.
- A Convex project.
- OAuth credentials for enabled providers.
- An OpenRouter API key for AI features.

Cloudflare and Expo accounts are needed only for their deployment paths.

## Local web setup

```bash
git clone https://github.com/hhushhas/track.git
cd track
corepack enable
pnpm install --frozen-lockfile
pnpm convex:dev
```

Keep `pnpm convex:dev` running. In another terminal:

```bash
pnpm --filter @track/web dev
```

Open `http://localhost:3000`. Convex creates the development deployment values in `.env.local`. Add the remaining auth, AI, and optional integration values documented in `.env.example`; do not copy the placeholder Convex deployment values over the generated values.

## Local mobile setup

Create the ignored operator configuration once:

```bash
cp apps/mobile/app.example.json apps/mobile/app.json
cp apps/mobile/eas.example.json apps/mobile/eas.json
pnpm --filter @track/mobile dev
```

Set the `EXPO_PUBLIC_*` values from `.env.example` for the development environment. Native OAuth, push, and store builds also require operator-owned provider configuration.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

CI runs the same gate after a frozen install. The mobile `build` script records that release builds are handled by EAS; web client, SSR, and Worker output is built locally.

## Configuration and safety

- Copy `wrangler.example.toml` to ignored `wrangler.toml` for Cloudflare variables.
- Copy `convex.prod.env.example` to ignored `convex.prod.env` for the production deployment selector.
- Keep credentials in `.env.local`, `.credentials/`, EAS, Convex, Cloudflare, or another provider secret store.
- Never commit deployment identifiers, credentials, personal data, working logs, crash reports, or store-submission material.
- Report security vulnerabilities through GitHub private vulnerability reporting.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution expectations. Track is licensed under the [MIT License](./LICENSE).
