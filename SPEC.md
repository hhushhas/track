# Track Technical Specification

## Status

Living technical specification for Track.

This spec follows the product context in `CONTEXT.md`. If product semantics conflict with this file, update the product context first, then update this spec.

## Product Core

Track is a multi-project, group-based project communication tool.

The technical system must support:

- Multiple Projects per user.
- Multiple Groups inside each Project.
- Group-scoped Conversations.
- Group-scoped Message visibility.
- AI Review that extracts Draft Records from Group Conversations.
- Reviewer workflows that classify Draft Records into Records.
- Project Records composed from Records across accessible Groups.
- `@track` as an inline assistant inside a Group Conversation.
- Message attachments.
- Convex-hosted avatar images.
- Push notifications.
- Immutable audit history.
- Project Record export.
- Observability for product, backend, permissions, and AI operations.

## Locked Stack

### Runtime Baseline

Use:

- Node.js 24 LTS.
- Latest stable TypeScript 6.
- pnpm as the package manager.
- Turborepo for monorepo task orchestration.

### Database And Backend

Use Convex as the database, backend, realtime layer, scheduled jobs layer, and backend function runtime.

Provisioned Convex projects:

```text
Project: track

Development:
  Cloud URL: https://enduring-impala-781.convex.cloud
  HTTP Actions URL: https://enduring-impala-781.convex.site

Production:
  Cloud URL: https://fleet-manatee-941.convex.cloud
  HTTP Actions URL: https://fleet-manatee-941.convex.site
```

Local `.env` stores both development and production Convex deploy keys. Do not record deploy key values in docs.

Use Convex components for:

- Persistent text streaming for inline Track Assistant responses.
- RAG/vector search.
- Rate limiting.
- Realtime user presence.

Use Convex file storage for attachments unless implementation research shows a better fit.

Use Convex file storage for user avatar images.

### Frontend Web

Use TanStack Start.

Use the TanStack frontend suite where it fits:

- TanStack Router.
- TanStack Query.
- TanStack Form.
- TanStack Table where tabular Project Record views need it.
- TanStack Virtual where long conversations/record lists need virtualization.

Shortcuts are in scope for the web app, but the exact package can be decided during implementation.

### Mobile

Use React Native with Expo.

Mobile and web should have full product parity.

Mobile should share domain logic, validation, and app semantics with web through `packages/shared`.

Web shadcn/ui components will not directly carry over to React Native, so mobile uses native components themed to the same Track design system.

Mobile UI component strategy:

- Preserve feature parity with web.
- Theme mobile to Track's own design system.
- Use NativeWind for Tailwind-style mobile styling and shared token language.
- Use React Native Reusables selectively as a shadcn-like starter, but own the copied components.
- Use Expo-native/native-feeling components where better, including `expo-image`, FlashList, native stacks/tabs, native modals, and native menus.
- Share theme tokens, domain logic, schemas, and formatting through `packages/shared`.

### Upload UI

Store uploads in Convex.

Use Convex File Storage for:

- Avatar images.
- Message attachments.
- Export files.

Recommended UI/helper libraries:

- Web picker/dropzone: `react-dropzone` or a shadcn-compatible dropzone component.
- Mobile image picker: `expo-image-picker`.
- Mobile document picker: `expo-document-picker`.

UploadThing is likely the "nice upload library" being referenced. It is useful as an end-to-end upload service, but it should not be the primary storage path if Convex owns files.

### AI

Use AI SDK with the OpenRouter community adapter.

Primary model:

```text
anthropic/claude-sonnet-4.6
```

AI workloads:

- AI Review.
- Track Assistant.
- Record extraction.
- Evidence-grounded question answering.
- Summaries/timeline/action item projections.

### UI And Styling

Use shadcn/ui and Tailwind CSS.

Customize the theme to match `ui-example.html`:

- Base stone: `#1b1917`.
- Accent yellow: `#f0b100`.
- Dense, calm, work-focused interface.
- Vercel/shadcn-inspired UI.
- No generic purple AI styling.

Use `streamdown` for rendering streamed Track Assistant responses in the Conversation.

### Auth

Use Google OAuth 2.0 only.

No email/password login.

2FA method:

- TOTP authenticator app is required.
- Backup/recovery codes are required.
- Optional trusted device can be supported.
- No SMS/email OTP.
- WebAuthn/passkeys can be considered as an additional factor later.

Use Better Auth.

Use the Convex Better Auth integration/component if it supports the selected plugin set cleanly.

### Billing

No billing system.

The product tracks billable Records, but does not charge users or manage subscriptions.

### Infra And Hosting

Deploy web on Cloudflare Workers with Wrangler.

Production domain:

```text
track.q9labs.ai
```

Convex hosts the backend/data layer. Cloudflare Workers hosts the TanStack Start web app.

### Repository

GitHub repository:

```text
hhushhas/track
```

Repo has not been created yet.

Use a pnpm + Turborepo monorepo.

Initial structure:

```text
apps/
  web/
  mobile/

packages/
  shared/

convex/

SPEC.md
CONTEXT.md
```

Use TypeScript import aliases for clean cross-package imports.

## Recommended Package Responsibilities

### `apps/web`

TanStack Start app.

Responsibilities:

- Project List / project switcher.
- Group List / group switcher.
- Group Conversation UI.
- Inline Draft Record review UI.
- Project Record views.
- Member, Group, and AI settings.
- Google OAuth login and 2FA flows.
- Streaming Track Assistant UI.
- Attachment upload/download UI.
- Project Record export UI.
- Push notification permission and settings UI.

### `apps/mobile`

Expo app.

Responsibilities:

- Mobile-first Project List.
- Group Conversation.
- Track Assistant mention UX.
- Record viewing.
- Full review flows with mobile ergonomics.
- Push notification support.
- Attachment capture/upload/download UX.

### `packages/shared`

Shared TypeScript logic.

Responsibilities:

- Domain constants.
- Shared labels and enums.
- Shared validation schemas.
- Shared permission helpers.
- Shared AI prompt/input/output schemas.
- Shared formatting helpers.
- Shared hooks only when they are truly portable between web and mobile.

Types should be inferred from schemas where possible.

### `convex/`

Convex backend.

Suggested organization:

```text
convex/
  schema.ts
  auth/
  projects/
  groups/
  messages/
  attachments/
  records/
  audit/
  exports/
  notifications/
  observability/
  ai/
  presence/
  rateLimit/
  rag/
  streams/
  crons/
  lib/
```

Keep Convex modules organized by domain, not by generic CRUD buckets.

## Core Data Model

This is conceptual, not final Convex schema code.

```text
users
  google identity
  profile
  avatarStorageId
  2FA state

projects
  name
  client label
  created by
  settings

projectMembers
  projectId
  userId
  role: owner | admin | staff | client
  extraAuthorities

groups
  projectId
  name
  kind: general | internal | commercials | custom
  settings

groupMembers
  groupId
  userId
  membership role/status

messages
  projectId
  groupId
  authorId
  body
  mentions
  attachmentIds
  createdAt

attachments
  projectId
  groupId
  messageId
  storageId
  filename
  contentType
  size
  uploadedBy
  createdAt

aiReviews
  projectId
  groupId
  status
  trigger: scheduled | manual
  startedAt
  finishedAt

draftRecords
  projectId
  groupId
  sourceMessageIds
  proposed fields
  status

records
  projectId
  groupId
  sourceMessageIds
  type
  classification
  status
  reviewedBy
  reviewedAt

auditEvents
  projectId
  groupId
  actorId
  entityType
  entityId
  action
  before
  after
  createdAt

exports
  projectId
  requestedBy
  format
  filters
  status
  storageId
  createdAt

notificationSubscriptions
  userId
  platform
  tokenOrEndpoint
  enabled
  createdAt

notificationSettings
  userId
  globalMode: all | mentions | none
  createdAt
  updatedAt

groupNotificationSettings
  userId
  groupId
  mode: inherit | all | mentions | none
  createdAt
  updatedAt

observabilityEvents
  projectId
  groupId
  userId
  eventType
  severity
  metadata
  createdAt

assistantThreads / streams
  projectId
  groupId
  requesterId
  prompt message
  streamed answer
  evidence ids
```

## Access Rules

Project role is not enough to read messages.

Access is determined by Group Membership.

Rules:

- A user can see a Project if they are a Project Member.
- A user can see a Group if they are a Group Member.
- A user can see a Message only if they can see its Group.
- A user can see a Draft Record only if they can access its source Group and have appropriate review/view permission.
- A Record inherits visibility from its source Group by default.
- Track Assistant can only use evidence the requesting user can access.
- Review authority must respect Group access.

Structure-management rules:

- Owner/Admin can create Projects.
- Owner/Admin can create Groups.
- Owner/Admin can change Group Membership.
- Staff/Client can request or suggest new Projects/Groups/changes through chat, but cannot create structure directly.

Attachments follow Message visibility. If a user cannot access the source Group, they cannot access attachments from that Group.

Exports must respect the requesting user's Group access and filters.

## AI Semantics

### AI Review

AI Review is background/manual extraction.

It should:

- Run per Group.
- Use the Group Conversation and existing Project Record context as input.
- Produce Draft Records.
- Keep source message citations.
- Avoid silently making Records official.

Recommended default:

- Project-level AI Review frequency.
- Group-level override if needed.
- Incremental scheduled review by default.
- Manual deep review for full Group re-scan.

Incremental AI Review means:

- Store a per-Group review cursor such as `lastReviewedMessageId` and `lastReviewedAt`.
- Scheduled review reads only new or changed Messages since that cursor.
- The model also receives compact durable context: existing active Records, recent summary, unresolved Draft Records, and relevant source evidence.
- The review then advances the cursor after successful completion.
- This keeps cost/latency low while preserving project memory.

Manual deep review means:

- Reviewer explicitly asks Track to re-read the full accessible Group Conversation.
- Useful for repair, audits, or when earlier reviews missed context.

### Track Assistant

Track Assistant is invoked by `@track` inside a Group.

It should:

- Respond inline as `Track`.
- Stream the response.
- Answer from the current Group by default.
- Offer to broaden to other accessible Groups or Project Records.
- Give natural answers: yes, no, partly, or not enough evidence.
- Cite source Messages/Records for factual claims.
- Avoid judging intent.
- Never expose evidence from inaccessible Groups.
- Offer to create a Draft Record when the answer reveals a decision, task, blocker, or scope-relevant item.

## Streaming

Use Convex persistent text streaming for assistant responses.

Use `streamdown` to render streamed markdown in the Conversation.

Streaming must support:

- Interrupted/reloaded clients.
- Multiple members watching the same Group.
- Persistent completed assistant answers.
- Evidence links after completion.

## Attachments

Attachments are in Track scope.

Supported first-pass attachment types:

- Images/screenshots.
- PDFs.
- Documents.
- Plain text files.

Voice notes are preserved as evidence now. Transcription can come later.

Attachment rules:

- Attachments belong to Messages.
- Attachments inherit Message and Group visibility.
- AI Review and Track Assistant may use supported attachment content when extracted text is available.
- Unsupported attachment content should still be preserved as evidence, even if not semantically indexed.

Attachment extraction scope:

- Semantically index plain text files.
- Semantically index PDFs with embedded text.
- Semantically index common documents if extraction is straightforward.
- Preserve screenshots/images as evidence now; OCR can come later.
- Preserve scanned PDFs as evidence now; OCR can come later.
- Preserve voice notes as evidence now; transcription can come later.

## Avatars

Avatar image upload is in Track scope.

Rules:

- Avatar files are stored in Convex File Storage.
- User profile stores the Convex storage ID.
- Avatar upload should enforce image content type and size limits.
- Avatar changes should write an audit event if needed for account/security traceability.

## Notifications

Push notifications are in Track scope.

Notification surfaces:

- Web push for `apps/web`, where browser support allows it.
- Mobile push for `apps/mobile` through Expo.

Notify for:

- New message in a Group the user belongs to.
- Direct user mention in a Group.
- `@track` mention response completed or needs attention.
- Draft Record needing reviewer attention.
- User assigned to a Record/action item.
- Export completed or failed.

Notifications must respect Group Membership.

Notification preferences:

- Global default: `all`, `mentions`, or `none`.
- Per-Group override: `inherit`, `all`, `mentions`, or `none`.
- Group setting takes priority for that Group.
- Direct security/account notifications may bypass muted message settings.

Web push implementation:

- Use direct Web Push with VAPID for browser push.
- VAPID keys were generated locally on `2026-04-27`.
- Local env file: `scratchpad/credentials/track-web-push-vapid.env`.
- Keep the VAPID private key in provider secret stores only.
- Do not add a notification SaaS unless product needs like campaigns, analytics, or dashboard-driven notification management appear.

## Audit History

Audit history is immutable.

Audit events should be written for:

- Project created/updated.
- Group created/updated.
- Group membership changed.
- Message sent/deleted if deletion is allowed.
- Attachment uploaded/deleted if deletion is allowed.
- Draft Record created/edited/ignored/classified.
- Record created/edited/reclassified.
- Export requested/completed.
- Permission/authority changes.

Audit history should be append-only. Do not mutate prior audit events.

## Export

Project Record export is in Track scope.

Export should support:

- Filter by Project.
- Filter by Group.
- Filter by date range.
- Filter by classification/type/status.
- Include source messages/evidence.

Initial formats:

- PDF for human/client sharing.
- CSV for billing/accounting workflows.

Export must respect requester access.

PDF export pipeline:

- Use a structured HTML print template as the source of truth for PDF layout.
- Generate PDFs server-side through an export job.
- Store generated export files in Convex File Storage.
- Store export job status, filters, requester, and output storage ID in Convex.
- Keep PDF generation deterministic enough that the same filters produce a comparable audit packet.

Initial PDF export contents:

- Cover page with Project, client label, export ID, exported by, generated timestamp, timezone, filters, and included Groups.
- Executive summary for the selected filters/date range.
- Record summary metrics by type, classification, status, owner, and billable/included-in-scope flags.
- Timeline of relevant Records and decisions.
- Records table with IDs, titles, type, classification, status, owner, requester, source Group, reviewed by, and reviewed at.
- Billable/commercial section for accessible Records classified as billable or commercially relevant.
- Action items grouped by owner/status.
- Decisions and scope changes with evidence references.
- Evidence appendix with source message excerpts, timestamps, authors, Group, and attachment references.
- Attachment index with filename, content type, source message, source Record if any, and extraction/indexing status.
- Audit appendix for relevant Record classification, reclassification, export, and permission events.

PDF export presets:

- Client Summary: shorter PDF for invoice/client review.
- Full Audit Packet: longer PDF with evidence and audit appendices.

## Observability

Observability is required.

Use Axiom as the external observability sink from day one, alongside Convex product/audit data.

Track at minimum:

- AI Review runs, duration, input size, output status, model, and cost metadata when available.
- Track Assistant invocations, duration, model, token/cost metadata when available, and retrieval scope.
- Permission denials.
- Rate-limit hits.
- Export jobs.
- Push notification delivery attempts/failures.
- Convex action failures.

Observability shape:

- Convex remains the source for user-visible audit history and product records.
- Axiom is for operational events, errors, traces, performance, and AI/job debugging.
- Use correlation IDs across web, mobile, Convex actions, AI calls, export jobs, and notification jobs.
- Log structured events, not prose blobs.
- Keep raw message content out of operational logs unless a narrowly scoped debug path is explicitly enabled.
- Default retention: 30 days for high-volume operational events, 90 days for error/security/audit-adjacent operational events.

Do not log secrets, OAuth tokens, raw private credentials, or unnecessary sensitive content.

## RAG / Vector Search

Use Convex RAG component.

Index at least:

- Messages.
- Records.
- Draft Records if useful.

Search must be permission-aware. A user should never retrieve inaccessible evidence through semantic search.

Recommended retrieval default for `@track`:

1. Current Group messages and Records.
2. Accessible Project Records.
3. Other accessible Groups only after explicit broadening or clear user intent.

## Rate Limiting

Use Convex rate limit component.

Rate limit at least:

- `@track` assistant invocations.
- Manual AI Review runs.
- Message sending if spam becomes a concern.
- Invite/member-management actions.

Rate limits should be scoped by user and project/group where appropriate.

## Presence

Use Convex presence component.

Presence should support:

- Online/offline state.
- Currently active Project.
- Currently active Group.
- Typing state for Conversations.
- "Viewing record" or "reviewing draft" later if useful.

## Deployment

Web:

```bash
wrangler deploy
```

Target:

```text
track.q9labs.ai
```

Convex:

- Use Convex deployment environments.
- Keep production secrets in the deployment environment, not source code.
- Development Convex cloud URL: `https://enduring-impala-781.convex.cloud`.
- Development Convex HTTP Actions URL: `https://enduring-impala-781.convex.site`.
- Production Convex cloud URL: `https://fleet-manatee-941.convex.cloud`.
- Production Convex HTTP Actions URL: `https://fleet-manatee-941.convex.site`.
- Keep Convex deploy keys in `.env` locally and provider secret stores in deployment.

Mobile:

- Expo development builds during development.
- Apple App Store submission is in scope.
- Google Play Store submission is in scope.

Provisioned mobile/store identity:

```text
Bundle/package id: ai.q9labs.track
App Store Connect app name: Q9 Track
App Store Connect app id: 6763930104
Google Play app name: Track
Google Play app id: 4975775109941853146
Google Cloud project: track-494517
```

Credential details are recorded in `scratchpad/store-auth-preflight-2026-04-26.md` and `scratchpad/provisioning-status-2026-04-27.md`. Secret material remains local-only under `scratchpad/credentials/`.

## Testing And Gates

Recommended test stack:

- Typecheck: TypeScript.
- Lint: Oxlint.
- Unit tests: Vitest.
- UI/component tests: Testing Library where useful.
- E2E smoke tests: Playwright for web.

High-risk tests to prioritize:

- Group access boundaries.
- Track Assistant permission-safe retrieval.
- Record visibility from source Group.
- Draft Record classification.
- Google OAuth session handling.
- 2FA enrollment and login enforcement.
- Attachment access boundaries.
- Push notification routing respects Group access.
- Immutable audit events for record classification and permission changes.
- Export respects filters and access boundaries.
- Observability does not leak secrets.

## Missing Decisions

These need to be decided before implementation gets too deep:

1. Store listing content and screenshots.
2. Whether to grant the Play submit service account production release permission.

## Track Scope

### In Scope

```text
Auth
  Google OAuth
  2FA
  profile
  Convex avatar upload

Projects
  multiple Projects
  project roles
  Project List

Groups
  default Groups: general, internal, commercials
  explicit Group Membership
  group notification settings

Conversation
  realtime messages
  mentions
  attachments
  presence

Track Assistant
  @track mention
  streaming inline answer
  current Group by default
  evidence citations
  permission-safe retrieval

AI Review
  manual run
  scheduled run
  Draft Record extraction

Records
  review/classify Draft Records
  Project Record view
  immutable audit history
  export PDF/CSV

Notifications
  push notifications
  global preferences
  per-Group override

Observability
  AI runs
  permission denials
  rate limits
  push/export failures
```

### Product Boundary

```text
Advanced AI
  no autonomous agent taking actions
  no cross-Project reasoning
  no hidden access to restricted Groups

Web/mobile parity
  web and mobile should support the same product capabilities
  interactions may differ by platform ergonomics

Native app release
  Expo development builds during development
  Apple App Store submission
  Google Play Store submission
```

## Initial Recommendations

- Keep Group Membership as the hard permission boundary.
- Keep one review authority: `Can Review AI Records`.
- Make `@track` available to all Group members, including Clients, but strictly permission-bound.
- Use current Group as the default assistant search scope.
- Add explicit "search all accessible groups" UX behind a clear action.
- Maintain web/mobile feature parity while adapting interaction details per platform.
