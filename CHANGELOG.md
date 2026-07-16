# Changelog

## 2026-07-16

- Refreshed the web design system, workspace header and rail, quotes, attachment marks, product vocabulary, and added the tested presentational task and thread component kits for upcoming feature releases.
- Reframed Track's target philosophy around conversation-led communication and first-class task management: peer Companies collaborate through Projects, Channels, Discord-style threads, scoped memory, and human-confirmed AI work.
- Split Channel threads into an independent implementation specification, kept task management conditionally thread-compatible, and added threads plus WhatsApp-style mobile push notifications to the roadmap.
- Expanded the approved memory direction so imports may declare Project or Channel scope and explicit scans produce same-scope task suggestions.

## 2026-07-13

- Completed the production removal of Records, Draft Records, AI review, and record exports by retiring the legacy Convex functions, data, fields, audit entries, and obsolete assistant prompts.
- Updated Better Auth to 1.6.15 across the monorepo so Convex production bundles build successfully with the current Kysely dependency.
- Removed invitation emails and audit history from the web workspace rail, stopped fetching both datasets there, collapsed the rail by default, kept notification settings accessible beneath its expand control, and cleared the route's mention-rendering key warning.

## 2026-07-12

- Specified the approved first-class task-management direction: multiple project and Channel boards, task suggestions grounded in chat, human confirmation, live conversation cards, scoped collaboration, permissions, web and mobile behavior, backend boundaries, and phased verification.
- Specified the approved first-class Company direction: multi-company Relationships, consent-based shared Projects, neutral roles, explicit Channel access, private discovery, peer governance, retained read-only history, guided legacy migration, task integration, and phased verification.

## 2026-07-11

- Added keyboard-aware mobile email/password sign-in with two-factor completion for reusable store-review and team access.
- Removed unused overlay and legacy external-storage permissions from Android release manifests.
- Replaced overlapping product, specification, design, and user-story monoliths with maintained product, architecture, design, and roadmap documentation plus a repository-level agent guide.
- Removed Records, Draft Records, AI review, and record exports from the product model and live application while preserving conversation, evidence, assistant, memory, search, and audit workflows.
- Resolved the code-quality backlog by modularizing workspace UI responsibilities, restoring typed Convex memory calls, surfacing retryable mobile failures, adding a web not-found experience, and moving the workspace to stable TypeScript 7.0.2.
- Hardened local tooling with warning-free pnpm configuration, Nitro-aware preview and Wrangler settings, and consistent Convex environment aliases.
- Removed obsolete prototypes, starter utilities and assets, demo fixtures, unused UI components, sign-in experiments, and logo-generation tooling while retaining the final brand masters.
- Removed internal work logs and operator-owned deployment configuration from version control, added public configuration templates, and sanitized documented environment values.
- Added open-source project documentation, community policies, and dependency automation.
- Updated vulnerable production dependencies and added a clean production dependency audit to CI.

## 2026-06-05

- Added the Phase 1 project memory substrate with Upstash Box pointers, memory import jobs, scoped memory tools, context gateway checks, scoped run-view cleanup, audit events, fake-adapter tests, and Convex import/audit regression coverage.
- Added bounded `context.md` loading to Track Assistant prompts and a web import dialog for pasted context, links, and files.
- Fixed Track Assistant prod memory answers by moving model work to a Node action, routing text prompts through OpenRouter REST, and skipping oversized image attachments before provider rejection.

## 2026-06-04

- Fixed production Google sign-in by ensuring the Cloudflare Worker and browser client have the Convex production URLs and by explicitly following the OAuth redirect returned by Better Auth.
- Added local Track Assistant text extraction for `.docx` and plain text attachments so common documents can be read even when the model file reader rejects uploaded files.

## 2026-05-23

- Fixed mobile sign-out and delete-account crashes by removing automatic native notification permission checks from auth startup.
- Added native auth-session restore handling so the mobile app does not redirect to sign-in while a persisted Better Auth session is still rehydrating.

## 2026-05-17

- Replaced the mobile app icon, splash, in-app mark, Android adaptive icon layers, favicon, and sign-in Google icon with assets derived from the official web Track logo set.
- Polished the mobile sign-in surface, icon buttons, row icons, conversation bubbles, account actions, and scrollable option sheets, including an exposed Sign out action.

## 2026-05-16

- Implemented the mobile v1 conversation scope with native Project/Group navigation, unread counts, conversation composer, attachments, voice notes, Track Assistant answers, reporting, notification preferences, account deletion, Apple sign-in configuration, and store-readiness notes.
- Added mobile backend contracts for Project/Group lists, read state, native push token registration/delivery, content reports, last active context, and account deletion requests.
- Added public Terms and in-app Privacy/Terms/Support access for mobile store review readiness.

## 2026-05-01

- Decomposed the workspace page into focused chat, sidebar, header, rail, search, records, settings, and hook modules.
- Added regression coverage for route state, record filtering, search result shaping, mentions, message sending, and notification body copy.
- Improved workspace notification diagnostics, pending attachment handling, project record export flows, and assistant/chat data shaping.
- Added a production Convex deploy selector so `pnpm convex:deploy:prod` uses the operator's production environment file even when local development values are present.

## 2026-04-29

- Added email/password access next to Google sign-in, including new-email account creation and the Google-proof flow for adding a password to an existing Google account.
- Added profile onboarding and profile settings for display name, designation, timezone, avatar, and bio.
- Added optional two-factor setup with authenticator apps, trusted devices, backup-code verification, and Track step-up freshness storage for sensitive actions.
- Polished profile settings UI with workspace navigation, provider icons, a custom timezone picker, 2FA status summaries, and richer teammate hover cards.
- Refined profile settings polish with flatter navigation, cleaner tab styling, top-aligned 2FA actions, member avatar URLs in hover cards, and avatar-derived card banners.
- Flattened profile onboarding into a single form surface and wired project export actions through a reusable two-factor step-up prompt.
- Reworked protected-action verification into a non-blocking floating 2FA panel and added a security-settings reset for the 10-minute grace period.
- Cleaned up the security settings hierarchy and showed stored profile photos in message row avatars.
- Enforced export 2FA step-up on the server and preserved 2FA state during workspace auth sync so CSV/PDF exports cannot bypass the prompt.
- Refined the sign-in screen into a flatter split layout with cleaner inputs, password visibility toggles, a single-line divider, clearer branding, and an icon-led email action.
- Added two interactive sign-in comparison routes with animated Track conversation previews for evaluating live-message entrance treatments.
- Improved the option B sign-in preview with transparent logo artwork, a higher page anchor, more conversation rows, and an infinite masked feed animation.
- Promoted the option B conversation-feed sign-in experience to the official `/sign-in` page.
- Updated privacy language for email/password auth, two-factor data, and expanded profile fields.
