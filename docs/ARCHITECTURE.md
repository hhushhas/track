# Architecture

Track is a pnpm monorepo with a TanStack Start web application, an Expo mobile application, shared TypeScript domain code, and a Convex backend.

## Runtime stack

- Node.js 24, pnpm 10.19.0, TypeScript 7.0.2.
- React 19, TanStack Start/Router, Vite, Tailwind CSS, and Base UI on web.
- Expo 55, Expo Router, and React Native on mobile.
- Convex for persistence, realtime queries, files, scheduled jobs, search, and server functions.
- Better Auth for sessions, OAuth, two-factor authentication, and the Convex auth bridge.
- AI SDK with OpenRouter for assistant model calls.
- Upstash Box for imported project-memory storage; Convex retains metadata, access state, and audit events.
- Cloudflare Workers for the web runtime and EAS for native builds.

## Package boundaries

`apps/web` owns browser routes, PWA behavior, workspace presentation, search, and browser integrations. `apps/mobile` owns native navigation and native platform capabilities. `packages/shared` contains platform-neutral role, group, notification, mention, and theme primitives. `convex` owns all persistent data and server-side authorization.

Clients may hide unavailable controls for usability, but Convex functions enforce every permission boundary. Public functions validate identity and access before reading or mutating data. Internal functions are used for trusted jobs and multi-step workflows.

## Core data flow

1. Better Auth establishes a session and the Convex bridge supplies its token.
2. Convex resolves the application user and project/group membership.
3. Reactive queries deliver accessible project, group, conversation, search, and notification state.
4. Mutations validate access, write the domain change, and emit audit or notification effects where required.
5. AI workflows assemble permission-filtered context, stream or persist results, and retain evidence references.

The schema in `convex/schema.ts` is the authoritative inventory of persisted data. Shared domain constants in `packages/shared/src/domain.ts` must match schema validators.

## AI and memory

Assistant requests start from the current group and may broaden only to other accessible project context. Model calls receive bounded conversation, attachment text, and imported memory. Results stream through Convex and cite evidence where available.

Project-memory imports are asynchronous jobs. Convex tracks import ownership and status while Upstash Box stores the imported content. Typed public and internal Convex references preserve the trust boundary between user actions and background processing.

## Generated files

- TanStack Router generates `apps/web/src/routeTree.gen.ts` from route files.
- Convex generates `convex/_generated/` from the schema and exported functions.

Regenerate these artifacts through their owning tool. Do not hand-maintain generated declarations as source design.

## Verification and delivery

CI installs with the frozen lockfile, then runs lint, typecheck, tests, the production dependency audit, and build. Web production output is generated under `apps/web/.output`. Native release builds are produced through EAS. Deployment identifiers and credentials stay in ignored local files or provider secret stores.
