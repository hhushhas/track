# Track

Track is a chat-first project collaboration app with evidence-grounded AI assistance. Teams organize work into projects and groups, communicate in context, and ask `@track` to answer questions from the information they can access.

The repository contains the TanStack Start web app, the Expo mobile app, shared TypeScript domain code, and the Convex backend. The current product still uses Records and Project Records. The planned successor is task management with Kanban boards; [CONTEXT.md](./CONTEXT.md#planned-direction) describes that direction without changing the current runtime model.

## Requirements

- Node.js 24 or newer
- pnpm 10.19.0
- A Convex project
- OAuth credentials for the sign-in providers you enable
- An OpenRouter API key for AI features

Cloudflare and Expo accounts are only required for their respective deployment paths.

## Local setup

```bash
git clone https://github.com/hhushhas/track.git
cd track
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fill the required values in `.env.local`, then initialize or connect the Convex development deployment:

```bash
pnpm convex:dev
```

In another terminal, start the web app on localhost:

```bash
pnpm --filter @track/web dev
```

The web app is available at `http://localhost:3000`.

Start the Expo app separately when working on mobile:

```bash
cp apps/mobile/app.example.json apps/mobile/app.json
cp apps/mobile/eas.example.json apps/mobile/eas.json
pnpm --filter @track/mobile dev
```

## Verification

Run the same gate used by CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

## Configuration

- `.env.example` documents runtime variables. Keep real values in `.env.local` or provider secret stores.
- `wrangler.example.toml` is the Cloudflare Workers template. Copy it to the ignored `wrangler.toml` and replace every placeholder before deploying.
- `convex.prod.env.example` is the production Convex selector template. Copy it to the ignored `convex.prod.env` for an operator-owned deployment.
- `apps/mobile/eas.example.json` is the public EAS template. Copy it to the ignored `apps/mobile/eas.json` and configure release values in EAS.
- `apps/mobile/app.example.json` is the public Expo template. The ignored `apps/mobile/app.json` contains the operator's application identity.

The repository does not include operator credentials, internal session logs, store-submission packets, or live deployment configuration.

## Repository layout

```text
apps/web/       TanStack Start web application
apps/mobile/    Expo / React Native application
packages/shared Shared domain and theme code
convex/         Backend schema, functions, jobs, and tests
assets/brand/   Final SVG brand assets
```

Product semantics live in [CONTEXT.md](./CONTEXT.md), technical decisions in [SPEC.md](./SPEC.md), and design rules in [DESIGN.md](./DESIGN.md). Known code-quality work is tracked in [CODE_QUALITY.md](./CODE_QUALITY.md).

## Contributing and security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md).

Track is available under the [MIT License](./LICENSE).
