# Track

Track is a project collaboration workspace with realtime conversation,
references, and permission-aware AI assistance. Its default-off Company release
adds peer Relationships, shared Projects, explicit Channels, immutable Company
exit archives, and guided migration from the legacy Project model across web,
mobile, shared contracts, and Convex. Its independently default-off thread
release adds named focused Channel conversations, follow and unread state,
manual lifecycle controls, scoped search, and complete web and mobile flows.

The default-off task release adds scoped Project and Channel boards, configurable
workflows, task details and lists, conversation evidence, human-reviewed AI
suggestions, search, notifications, and essential native workflows. It operates
with legacy Projects and does not require Channel threads or Company collaboration.

The combined implementation is locally verified and remains independently
default off. It has not been deployed, and local verification does not authorize
a production rollout, migration, or flag activation.

The [target product contract](./docs/PRODUCT.md) also defines dependable mobile
push. That companion capability remains independently controlled work tracked in
[docs/ROADMAP.md](./docs/ROADMAP.md).

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

- [Product](./docs/PRODUCT.md): target philosophy, product model, and access
  invariants.
- [Architecture](./docs/ARCHITECTURE.md): current stack, boundaries, and data
  flow.
- [Design](./docs/DESIGN.md): interface, tokens, interaction states, and
  accessibility.
- [Roadmap](./docs/ROADMAP.md): approved target behavior that has not shipped.
- [Channel threads specification](./docs/THREADS_SPEC.md): implemented
  default-off thread, unread, lifecycle, AI-context, and integration contract.
- [Task management specification](./docs/TASK_MANAGEMENT_SPEC.md): implemented
  default-off task, board, AI, access, and delivery contract.
- [Company relationships specification](./docs/COMPANY_RELATIONSHIPS_SPEC.md):
  implemented default-off Company, Relationship, shared-Project, Channel,
  access, exit, and migration contract.
- [Mobile push notification intent](./docs/MOBILE_PUSH_NOTIFICATIONS_SPEC.md):
  approved reliability direction that still needs a complete implementation
  contract.

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

Set `TRACK_COMPANY_MODEL_ENABLED=true` on the local Convex deployment to expose
Company collaboration. The flag is server-authoritative and independent from
`TRACK_THREADS_ENABLED` and `TRACK_TASKS_ENABLED`. Archive, Company-exit,
redaction, account-deletion, and cleanup enforcement remains server-side even
when Company creation surfaces are disabled.

Set `TRACK_TASKS_ENABLED=true` to expose task routes and controls and to start
new-message detection. This flag is independent from Company and thread flags;
existing conversation remains usable when tasks are disabled.

Set `TRACK_THREADS_ENABLED=true` on the local Convex deployment to expose
Channel threads. Threads remain fully usable when Company collaboration or task
management is disabled. The server flag hides thread discovery, routes,
creation, search, and ordinary delivery when off while retaining lifecycle and
cleanup enforcement for persisted data.

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
