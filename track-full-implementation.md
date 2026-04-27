# Track Full Implementation Spec

## 0. Authority

This file is the single source of truth for implementing Track.

It supersedes `CONTEXT.md`, `SPEC.md`, and `USER_STORIES.md` for execution. Those files may remain as historical context, but implementation decisions must be made from this file.

`DESIGN.md` remains the source of truth for visual design tokens, UI density, interaction feel, and platform-specific design rules. If this file and `DESIGN.md` conflict on visual styling, update both before implementing.

## 1. Spec Rules

### 1.1 Language

The terms below are normative:

- `MUST`: required for Track.
- `MUST NOT`: forbidden for Track.
- `SHOULD`: expected unless there is a documented implementation reason.
- `MAY`: optional.

Implementation agents MUST NOT treat examples as permission to weaken invariants.

### 1.2 Completion Rule

A feature is not complete until all applicable layers pass:

```text
shared contract
  -> Convex backend
  -> web implementation
  -> mobile implementation
  -> tests/gates
  -> docs/spec alignment
```

Web and mobile MUST be built side by side by vertical slice. A wave may implement backend/shared contracts first, but the wave is not accepted until both web and mobile expose the same product capability unless this file explicitly marks a platform exception.

### 1.3 Ambiguity Rule

If behavior is ambiguous, resolve in this order:

1. Preserve Group Membership as the hard access boundary.
2. Preserve immutable auditability.
3. Preserve evidence-grounded AI behavior.
4. Preserve web/mobile product parity.
5. Prefer the simplest implementation that passes gates.

If ambiguity affects security, permissions, billing-relevant classification, or data retention, stop and ask Hasan.

### 1.4 Secrets Rule

Secrets MUST live only in local `.env`, provider secret stores, or credential stores.

Docs MUST NOT contain actual secret values.

Safe values allowed in docs:

- Public URLs.
- Public client IDs when already intended for clients.
- Environment variable names.
- Credential file paths without file contents.

## 2. Product Definition

### 2.1 Product Promise

Track is a shared project communication tool that looks and feels like a normal group chat, while continuously turning communication into a structured, reviewable project record.

Track solves client/vendor memory loss around requests, approvals, scope, billing-relevant decisions, ownership, action items, and timelines.

### 2.2 Core Loop

```text
Project created
  -> default Groups created
  -> Staff/Client communicate in Groups
  -> AI Review proposes Draft Records
  -> Reviewer classifies Draft Records
  -> Records become Project Record
  -> @track answers evidence-based questions inline
  -> exports provide billing/audit support
```

### 2.3 Product Boundaries

Track MUST NOT become a full contract system, invoice system, dispute-resolution system, or enterprise organization/workspace suite in this build.

Track MUST support:

- Multiple Projects per user.
- Multiple Groups per Project.
- Explicit Group Membership.
- Normal chat inside Groups.
- Attachments.
- Presence.
- Push notifications.
- Google OAuth login.
- TOTP 2FA.
- Profiles and Convex-hosted avatar images.
- AI Review.
- Inline `@track` assistant.
- Draft Record review.
- Project Record.
- Immutable audit history.
- PDF and CSV export.
- Axiom observability.
- Web and mobile product parity.
- Apple App Store and Google Play Store submission.

Track MUST NOT support in this build:

- Organizations/workspaces above Projects.
- Billing/subscriptions/payments.
- Formal client acknowledge/dispute workflow.
- Separate billing-classifier/dispute-resolver roles.
- Autonomous AI actions.
- Cross-Project AI reasoning.
- Hidden AI access to restricted Groups.

## 3. Domain Model

### 3.1 Project

A Project is the overall client engagement.

Project owns:

- Members.
- Project roles.
- Extra authority.
- Groups.
- AI Review settings.
- Draft Records.
- Project Record.
- Export jobs.
- Audit events.

There is no organization/workspace layer above Project.

### 3.2 Group

A Group is a focused chat space inside a Project.

Every Message belongs to exactly one Group.

Every Record inherits visibility from its source Group by default.

Default Groups created with every Project:

| Kind | Name | Default Members |
| --- | --- | --- |
| `general` | General | Owner, Admin, Staff, Client |
| `internal` | Internal | Owner, Admin, Staff |
| `commercials` | Commercials | Owner, Admin |

Group Membership is explicit. Role defaults only seed the initial list.

### 3.3 Member

A Member is any user in a Project.

### 3.4 Roles

Project roles:

| Role | Meaning |
| --- | --- |
| Owner | Vendor-side project owner with full authority |
| Admin | Vendor-side admin with management authority |
| Staff | Vendor-side participant |
| Client | Client-side participant |

### 3.5 Extra Authority

`Can Review AI Records` is a Project-level authority that may be granted to Staff.

Owner and Admin always have review authority.

Client MUST NOT classify Draft Records in this build.

### 3.6 Conversation

A Conversation is the ordered Message thread inside one Group.

### 3.7 Message

A Message is a single chat item authored by a Group Member.

Message may contain:

- Body text.
- Mentions.
- Attachment references.
- `@track` invocation.

### 3.8 AI Review

AI Review is a scheduled or manual extraction pass over a Group Conversation.

AI Review produces Draft Records. It MUST NOT directly create official Records.

### 3.9 Track Assistant

Track Assistant is invoked by mentioning `@track` inside a Group Conversation.

Track Assistant answers inline, streams when possible, cites evidence, and uses only evidence visible to the requesting user.

### 3.10 Draft Record

A Draft Record is an AI-proposed structured item that has not yet been reviewed.

Draft Records appear inline in the source Group Conversation near the evidence that caused them.

### 3.11 Record

A Record is a reviewed item in the Project Record.

Records preserve:

- Source Group.
- Source Messages.
- Evidence.
- Reviewer.
- Classification.
- Status.
- Audit trail.

### 3.12 Project Record

The Project Record is the official structured history of a Project, assembled from reviewed Records across Groups the viewer can access.

### 3.13 Classification

Initial classifications:

| Classification | Meaning |
| --- | --- |
| `official_record` | Part of official Project Record but not necessarily billable |
| `billable_scope` | Official and billable/commercially relevant |
| `non_billable_scope` | Official but explicitly non-billable |
| `informational` | Useful context, not scope/task/billing |
| `ignored` | Not part of Project Record |

### 3.14 Record Types

Initial Record types:

- `task`
- `scope_change`
- `decision`
- `action_item`
- `blocker`
- `question`

### 3.15 Record Status

Initial statuses:

- `proposed`
- `accepted`
- `declined`
- `open`
- `in_progress`
- `blocked`
- `done`

## 4. Permission Contract

### 4.1 Core Invariant

Project role is not enough to read Messages.

Group Membership is the hard visibility boundary.

### 4.2 Read Rules

| Object | Read Rule |
| --- | --- |
| Project | User is a Project Member |
| Group | User is a Group Member |
| Message | User is a Group Member for the Message's Group |
| Attachment | User can read source Message |
| Draft Record | User can access source Group and has view/review permission |
| Record | User can access source Group |
| Audit Event | User can access affected Project/Group and action is visible to role |
| Export | User can access all included source data |

### 4.3 Write Rules

| Action | Owner | Admin | Staff | Client |
| --- | --- | --- | --- | --- |
| Create Project | yes | yes | no | no |
| Create Group | yes | yes | no | no |
| Change Group Membership | yes | yes | no | no |
| Invite Member | yes | yes | no | no |
| Send Message in accessible Group | yes | yes | yes | yes |
| Upload Attachment in accessible Group | yes | yes | yes | yes |
| Request/suggest work via chat | yes | yes | yes | yes |
| Run manual AI Review | yes | yes | reviewer Staff only | no |
| Classify Draft Record | yes | yes | reviewer Staff only | no |
| Export Project Record | yes | yes | reviewer Staff only | no by default |
| Configure Project AI settings | yes | yes | no | no |
| Configure own notification settings | yes | yes | yes | yes |

### 4.4 Permission-Safe AI

AI Review and Track Assistant MUST NOT leak inaccessible Group data.

Track Assistant retrieval scope defaults to:

1. Current Group Messages and Records.
2. Accessible Project Records.
3. Other accessible Groups only after explicit user intent or explicit broadening action.

## 5. Technical Stack

### 5.1 Runtime

- Node.js 24 LTS.
- TypeScript 6.
- pnpm.
- Turborepo.

### 5.2 Backend

Convex owns:

- Database.
- Backend functions.
- Realtime subscriptions.
- Scheduled jobs.
- File storage.
- HTTP actions.

Convex components:

- Persistent text streaming.
- RAG/vector search.
- Rate limiting.
- Presence.

### 5.3 Frontend Web

Web app:

- TanStack Start.
- TanStack Router.
- TanStack Query.
- TanStack Form.
- TanStack Table where tables are needed.
- TanStack Virtual for long lists.
- shadcn/ui.
- Tailwind CSS.
- `streamdown` for streamed assistant markdown.

### 5.4 Mobile

Mobile app:

- React Native.
- Expo.
- Expo Router.
- NativeWind or shared token-based styling.
- Expo push notifications.
- `expo-image`.
- `expo-image-picker`.
- `expo-document-picker`.

Mobile MUST preserve feature parity with web, while using native interaction patterns.

### 5.5 Shared Package

`packages/shared` owns:

- Domain constants.
- Shared labels.
- Validation schemas.
- Permission helpers.
- AI input/output schemas.
- Formatting helpers.
- Shared theme tokens.

Types SHOULD be inferred from schemas where practical.

### 5.6 AI

AI SDK with OpenRouter provider.

Primary model:

```text
anthropic/claude-sonnet-4.6
```

### 5.7 Auth

Better Auth.

Login:

- Google OAuth 2.0 only.
- No email/password.

2FA:

- TOTP required.
- Backup/recovery codes required.
- Optional trusted device.
- No SMS/email OTP.
- WebAuthn/passkeys MAY be added later as an additional factor.

### 5.8 Observability

Axiom is the external operational observability sink.

Convex remains the source for product/audit records.

Default retention:

- 30 days for high-volume operational events.
- 90 days for error/security/audit-adjacent operational events.

### 5.9 Hosting

Web deploys to Cloudflare Workers through Wrangler.

Production domain:

```text
track.q9labs.ai
```

Mobile releases through Expo/EAS to Apple App Store and Google Play.

## 6. Environments

### 6.1 Convex

Development:

```text
Cloud URL: https://enduring-impala-781.convex.cloud
HTTP Actions URL: https://enduring-impala-781.convex.site
```

Production:

```text
Cloud URL: https://fleet-manatee-941.convex.cloud
HTTP Actions URL: https://fleet-manatee-941.convex.site
```

Deploy keys are stored in `.env` and provider secret stores only.

### 6.2 Mobile Identity

```text
Bundle/package id: ai.q9labs.track
App Store Connect app name: Q9 Track
App Store Connect app id: 6763930104
Google Play app name: Track
Google Play app id: 4975775109941853146
Google Cloud project: track-494517
```

### 6.3 Required Env Vars

Runtime:

- `VITE_CONVEX_URL`
- `CONVEX_SITE_URL`
- `CONVEX_DEPLOYMENT`
- `CONVEX_DEPLOY_KEY`
- `AUTH_SECRET`
- `TOTP_ENCRYPTION_SECRET`
- `OPENROUTER_API_KEY`
- `AI_MODEL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `AXIOM_TOKEN`
- `AXIOM_DATASET`
- `AXIOM_ORG_ID`

Google OAuth:

- `GOOGLE_CLIENT_ID_WEB`
- `GOOGLE_CLIENT_SECRET_WEB`
- `GOOGLE_CLIENT_ID_IOS`
- `GOOGLE_CLIENT_ID_ANDROID_UPLOAD`
- `GOOGLE_CLIENT_ID_ANDROID_PLAY_SIGNING`

Deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## 7. Data Model Contract

Convex schema MUST model at least these tables.

### 7.1 Users

Fields:

- `googleSubject`
- `email`
- `displayName`
- `avatarStorageId`
- `twoFactorEnabled`
- `createdAt`
- `updatedAt`

Indexes:

- `by_google_subject`

### 7.2 Projects

Fields:

- `name`
- `clientLabel`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `by_created_by`

### 7.3 Project Members

Fields:

- `projectId`
- `userId`
- `role`
- `canReviewAiRecords`
- `createdAt`
- `updatedAt`

Indexes:

- `by_project`
- `by_user`
- `by_project_user`

### 7.4 Groups

Fields:

- `projectId`
- `kind`
- `name`
- `createdBy`
- `aiReviewSettings`
- `createdAt`
- `updatedAt`

Indexes:

- `by_project`

### 7.5 Group Members

Fields:

- `projectId`
- `groupId`
- `userId`
- `createdAt`
- `updatedAt`

Indexes:

- `by_group`
- `by_user`
- `by_group_user`

### 7.6 Messages

Fields:

- `projectId`
- `groupId`
- `authorId`
- `body`
- `mentions`
- `attachmentIds`
- `trackInvocationId`
- `createdAt`

Indexes:

- `by_group_created_at`
- `by_project_created_at`

### 7.7 Attachments

Fields:

- `projectId`
- `groupId`
- `messageId`
- `storageId`
- `filename`
- `contentType`
- `size`
- `uploadedBy`
- `extractionStatus`
- `createdAt`

Indexes:

- `by_message`
- `by_group`

### 7.8 AI Reviews

Fields:

- `projectId`
- `groupId`
- `trigger`
- `status`
- `startedAt`
- `finishedAt`
- `lastReviewedMessageId`
- `lastReviewedAt`
- `model`
- `summary`
- `error`

Indexes:

- `by_group_started_at`
- `by_project_started_at`

### 7.9 Draft Records

Fields:

- `projectId`
- `groupId`
- `aiReviewId`
- `sourceMessageIds`
- `type`
- `title`
- `description`
- `proposedStatus`
- `proposedOwnerId`
- `evidence`
- `status`
- `createdAt`
- `updatedAt`

Indexes:

- `by_group_status`
- `by_project_status`

### 7.10 Records

Fields:

- `projectId`
- `groupId`
- `draftRecordId`
- `sourceMessageIds`
- `type`
- `classification`
- `status`
- `title`
- `description`
- `ownerId`
- `requestedById`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

Indexes:

- `by_project`
- `by_group`
- `by_project_classification`
- `by_project_status`

### 7.11 Audit Events

Audit Events are immutable.

Fields:

- `projectId`
- `groupId`
- `actorId`
- `entityType`
- `entityId`
- `action`
- `before`
- `after`
- `createdAt`
- `correlationId`

Indexes:

- `by_project_created_at`
- `by_group_created_at`
- `by_entity`

### 7.12 Exports

Fields:

- `projectId`
- `requestedBy`
- `format`
- `preset`
- `filters`
- `status`
- `storageId`
- `error`
- `createdAt`
- `completedAt`

Indexes:

- `by_project_created_at`
- `by_requested_by_created_at`

### 7.13 Notification Subscriptions

Fields:

- `userId`
- `platform`
- `tokenOrEndpoint`
- `enabled`
- `createdAt`
- `updatedAt`

Indexes:

- `by_user`

### 7.14 Notification Settings

Fields:

- `userId`
- `globalMode`
- `createdAt`
- `updatedAt`

Indexes:

- `by_user`

### 7.15 Group Notification Settings

Fields:

- `userId`
- `groupId`
- `mode`
- `createdAt`
- `updatedAt`

Indexes:

- `by_user_group`

### 7.16 Assistant Streams

Fields:

- `projectId`
- `groupId`
- `requesterId`
- `messageId`
- `status`
- `prompt`
- `answer`
- `evidenceIds`
- `createdAt`
- `completedAt`

Indexes:

- `by_group_created_at`
- `by_requester_created_at`

## 8. Function Contract

Convex functions MUST be organized by domain.

### 8.1 Auth

Required capabilities:

- Create or update user profile from Google identity.
- Enforce TOTP enrollment after first sign-in.
- Store avatar references.
- Read current authenticated user.

### 8.2 Projects

Required queries:

- List Projects visible to current user.
- Get Project detail if current user is a Project Member.
- Get Project settings if authorized.

Required mutations:

- Create Project.
- Update Project.
- Add Project Member through invite acceptance.
- Update Project role/authority.

Create Project MUST create default Groups and seed Group Membership.

### 8.3 Groups

Required queries:

- List Groups visible to current user in Project.
- Get Group detail if current user is Group Member.
- List Group Members.

Required mutations:

- Create Group.
- Add Group Member.
- Remove Group Member.
- Update Group settings.

### 8.4 Messages

Required queries:

- List Messages for accessible Group with pagination.
- Get Message evidence bundle for accessible Message.

Required mutations:

- Send Message.
- Register mentions.
- Attach uploaded files.
- Create Track Assistant invocation when body includes `@track`.

### 8.5 Attachments

Required actions/mutations:

- Generate upload URL or supported Convex upload flow.
- Store attachment metadata.
- Download/serve attachment if access-safe.
- Extract text when supported.
- Index extracted content when permitted.

### 8.6 AI Review

Required actions:

- Run manual review for one Group.
- Run scheduled incremental review for Groups due for review.
- Create Draft Records with source evidence.
- Persist AI run metadata.

Scheduled review MUST use cursor-based incremental scanning.

Manual deep review MAY scan the full accessible Group Conversation.

### 8.7 Track Assistant

Required actions:

- Parse `@track` invocation.
- Retrieve permission-safe evidence.
- Stream answer through persistent text streaming.
- Store completed answer.
- Attach evidence links.
- Offer Draft Record creation when useful.

### 8.8 Records

Required queries:

- List Draft Records needing review.
- List Records in Project filtered by Group/type/classification/status/date.
- Get Record detail with evidence if authorized.

Required mutations:

- Classify Draft Record.
- Create Record.
- Edit Record.
- Reclassify Record.
- Ignore Draft Record.

Every classification MUST write an audit event.

### 8.9 Notifications

Required actions:

- Register web push subscription.
- Register Expo push token.
- Notify new Group message according to preferences.
- Notify mentions.
- Notify reviewer attention.
- Notify assigned action item.
- Notify export completion/failure.

### 8.10 Exports

Required actions:

- Request export.
- Generate PDF.
- Generate CSV.
- Store generated file.
- Mark export complete/failed.

### 8.11 Observability

Required helpers:

- Emit structured Axiom event.
- Attach correlation ID.
- Redact sensitive fields.
- Record Convex product audit separately from Axiom operational event.

## 9. Feature Requirements

### 9.1 Authentication And Profile

Flow:

```text
Open app
  -> Google OAuth
  -> profile sync
  -> TOTP challenge/enrollment
  -> Project List
```

Requirements:

- Google OAuth is the only login path.
- First sign-in creates a user profile.
- TOTP enrollment is required before app access.
- Backup codes are generated and recoverable.
- User can update display name and avatar.
- Avatar uploads to Convex File Storage.
- Profile updates appear in message author UI, member list, and presence.

Acceptance:

- Unauthenticated user cannot access app routes.
- Authenticated user without TOTP cannot access Project data.
- Avatar access respects auth.

### 9.2 Projects

Requirements:

- Owner/Admin can create Projects.
- Creator becomes Owner.
- Default Groups are created.
- Group Membership is seeded from defaults.
- Project List shows only joined Projects.
- Project List shows unread/draft/needs-review counts only from accessible Groups.

Acceptance:

- Staff/Client cannot create Project.
- Created Project is visible to creator.
- Audit event is written.

### 9.3 Groups And Membership

Requirements:

- Owner/Admin can create Groups.
- Owner/Admin can add/remove Group Members.
- Group Membership controls visibility.
- Staff/Client can request/suggest changes only through chat.
- Users must be Project Members before Group Members.

Acceptance:

- Non-member cannot see Group, Messages, Records, attachments, or AI evidence.
- Membership changes apply immediately.
- Audit event is written.

### 9.4 Invites

Requirements:

- Owner/Admin can invite users to Project with role.
- Owner/Admin can invite directly to a Group with Project role.
- Invite acceptance creates Project Member and Group Member where applicable.
- Invite and acceptance write audit events.

Acceptance:

- Invite cannot grant access beyond selected role/Groups.
- Expired/invalid invites fail safely.

### 9.5 Conversation

Requirements:

- Group Members can send realtime Messages.
- Messages preserve author, body, created time, mentions, attachments.
- Long Conversations support pagination/virtualization.
- Mention detection powers notifications.
- `@track` mention creates assistant invocation.

Acceptance:

- User sees realtime updates in accessible Group.
- User cannot read or write inaccessible Group.
- Message send writes audit event only if policy requires chat-level audit; otherwise message itself is durable source.

### 9.6 Attachments

Supported first-pass:

- Images/screenshots.
- PDFs.
- Documents.
- Plain text files.

Preserve as evidence now:

- Screenshots/images.
- Scanned PDFs.
- Voice notes.

Extraction now:

- Plain text files.
- PDFs with embedded text.
- Common documents if straightforward.

OCR/transcription MAY come later.

Acceptance:

- Attachment inherits Message visibility.
- Unsupported extraction does not block evidence preservation.
- Extraction status is visible to users with access.

### 9.7 Presence

Requirements:

- Show online/offline state.
- Show active Project/Group when useful.
- Show typing state.

Acceptance:

- Presence does not leak restricted Group names to non-members.

### 9.8 AI Review

Requirements:

- AI Review runs per Group.
- Project-level frequency setting exists.
- Group-level override MAY exist.
- Manual run button exists.
- Scheduled review is incremental by default.
- Manual deep review is available to Reviewers.
- AI Review produces Draft Records only.
- Draft Records include source Message citations.

Incremental review:

```text
lastReviewedMessageId / lastReviewedAt
  -> read new Messages
  -> include durable context
  -> create Draft Records
  -> advance cursor on success
```

Acceptance:

- AI Review never directly creates Record.
- AI Review never uses inaccessible Group evidence.
- Failed AI run records status/error without advancing cursor.

### 9.9 Draft Record Review

Requirements:

- Draft Record appears inline in source Group.
- Reviewer can classify as official, billable, non-billable, informational, or ignored.
- Reviewer can edit title/description/status/owner before accepting.
- Client can see vendor classification when they have source Group access.

Acceptance:

- Classification creates immutable audit event.
- Ignored Draft Record remains auditable.
- Client cannot classify Draft Record.

### 9.10 Project Record

Requirements:

- Project Record lists Records from accessible Groups.
- Filters: Group, date range, type, classification, status, owner.
- Record detail shows evidence and audit trail.

Acceptance:

- Project Record never reveals inaccessible Record existence unless specifically allowed as aggregate count.

### 9.11 Track Assistant

Requirements:

- Triggered with `@track`.
- Responds as `Track`.
- Streams inline in Conversation.
- Answers naturally.
- Uses evidence to answer yes/no/partly/not enough evidence.
- Avoids judging intent.
- Cites source Messages/Records.
- Current Group is default scope.
- May offer broadening to other accessible Groups.
- May offer Draft Record creation.

Example response posture:

```text
No, that does not match the record.

The latest agreement I found says the pricing page was approved as billable on Apr 21, and John acknowledged it in General. I found no later message reversing that decision.
```

Acceptance:

- No inaccessible evidence leaks.
- If evidence is insufficient, assistant says so.
- Completed answer remains visible after reload.

### 9.12 Notifications

Surfaces:

- Web Push with VAPID.
- Mobile Push with Expo.

Notify for:

- New Group message.
- Direct mention.
- Track Assistant completion/attention.
- Draft Record needing review.
- Assigned Record/action item.
- Export completion/failure.

Preferences:

- Global: `all`, `mentions`, `none`.
- Per Group: `inherit`, `all`, `mentions`, `none`.
- Group setting wins.

Acceptance:

- Notifications respect Group Membership.
- Muted Group does not send normal message notifications.
- Security/account notifications may bypass muted chat preferences.

### 9.13 Export

Formats:

- PDF.
- CSV.

PDF presets:

- `Client Summary`: default.
- `Full Audit Packet`: explicit option.

Client Summary includes:

- Cover page.
- Export metadata.
- Executive summary.
- Record metrics.
- Timeline.
- Records table.
- Billable/commercial items.
- Action items.
- Decisions/scope changes.
- Scoped evidence snippets.

Full Audit Packet additionally includes:

- Evidence appendix.
- Attachment index.
- Audit appendix.

Client-facing exports MUST show included Groups and filters.

Client-facing exports MUST NOT reveal names of restricted excluded Groups.

Acceptance:

- Export respects requester access.
- Export job status is visible.
- Generated files are stored in Convex File Storage.

### 9.14 Observability

Axiom events MUST be structured.

Required event families:

- `auth.*`
- `project.*`
- `group.*`
- `message.*`
- `attachment.*`
- `ai_review.*`
- `track_assistant.*`
- `record.*`
- `notification.*`
- `export.*`
- `permission.denied`
- `rate_limit.hit`
- `convex.action.failed`

Required fields:

- `event`
- `severity`
- `environment`
- `project_id`
- `group_id`
- `user_id`
- `correlation_id`
- `duration_ms`
- `status`
- `error_type`
- `error_message`

Rules:

- Do not log secrets.
- Do not log OAuth tokens.
- Do not log private credentials.
- Do not log raw message body by default.
- Do include counts, IDs, timing, model, token/cost metadata when available.

### 9.15 Rate Limiting

Rate limit:

- `@track` invocations.
- Manual AI Review.
- Message sending if spam appears.
- Invite/member management.
- Export generation.

Rate limits should be scoped by user plus Project/Group where appropriate.

## 10. UI And Platform Contract

### 10.1 Shared Product Surfaces

Web and mobile MUST both provide:

- Login/2FA.
- Profile/avatar.
- Project List.
- Group List.
- Group Conversation.
- Message send.
- Attachment upload/view.
- Presence.
- `@track` assistant.
- Inline Draft Record review.
- Project Record view.
- Record detail.
- Notification settings.
- Export request/view where platform permits.

### 10.2 Platform Differences

Web MAY use:

- Denser layouts.
- Left Project/Group navigation.
- Right rail for Project Record/AI Review.
- Keyboard shortcuts.
- Tables.

Mobile MAY use:

- Native stack/tab navigation.
- Bottom sheets.
- Native modals/menus.
- Camera/photo/document pickers.
- Push-first notification management.

### 10.3 Design Theme

Track UI MUST follow `DESIGN.md`.

Base colors:

- Stone: `#1b1917`.
- Yellow: `#f0b100`.

UI character:

- Dense.
- Calm.
- Work-focused.
- Vercel/shadcn inspired.
- No generic purple AI aesthetic.

## 11. Testing Contract

### 11.1 Required Gates

Every implementation wave must pass:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm run docs
```

### 11.2 High-Risk Tests

Prioritize tests for:

- Group access boundaries.
- Permission-safe AI retrieval.
- Draft Record classification.
- Record visibility from source Group.
- Google OAuth session handling.
- TOTP enrollment and challenge.
- Attachment access boundaries.
- Notification routing and preferences.
- Immutable audit events.
- Export access/filter boundaries.
- Observability redaction.

### 11.3 Feature Acceptance Rule

Each feature must define:

- Happy path test.
- Permission denial test.
- Audit test when state changes.
- Web UI proof.
- Mobile UI proof.
- Relevant observability proof for operational flows.

## 12. Execution Strategy

### 12.1 Execution Model

Execution is vertical-slice based.

Backend/shared contracts lead each wave. Web and mobile then implement the same capability side by side.

No wave is accepted if only web or only mobile is usable, unless this file explicitly grants a platform exception.

### 12.2 Parallelization Rule

Parallel work is allowed only when write scopes are disjoint.

Good split:

```text
Worker A: Convex/domain backend
Worker B: web UI for already-stable contract
Worker C: mobile UI for already-stable contract
Worker D: tests/docs/observability for same wave
```

Bad split:

```text
Worker A and Worker B both editing same schema/function surface without coordination.
```

### 12.3 Phase 0: Foundation

Goal:

- Make the repo executable and deployment-ready.

Status:

- Initial monorepo scaffold exists.
- GitHub repo exists.
- Web and mobile starter apps exist.
- Shared package exists.
- Convex schema skeleton exists.

Remaining tasks:

- Add CI.
- Add Cloudflare Worker config.
- Add Convex environment config.
- Add EAS config.
- Replace starter UI with Track shell.
- Add baseline smoke tests.

Exit gate:

- All root gates pass.
- CI runs same gates.
- Web preview starts.
- Mobile Expo start works.

### 12.4 Phase 1: Identity And Security

Goal:

- Users can sign in, pass TOTP, and maintain profile/avatar.

Depends on:

- Phase 0.

Wave 1.1: Auth Kernel

Tasks:

- Configure Better Auth Google OAuth.
- Wire Convex auth integration.
- Create user sync path.
- Protect web routes.
- Protect mobile routes.
- Add auth state to shared contract.

Exit gate:

- Unauthenticated users cannot access app.
- Google login creates/loads user.
- Web/mobile both show authenticated shell.

Wave 1.2: TOTP

Tasks:

- Add TOTP enrollment.
- Add TOTP challenge.
- Add backup codes.
- Add trusted device if cheap.
- Add tests for enforcement.

Exit gate:

- User cannot access Projects before 2FA requirement is satisfied.

Wave 1.3: Profile And Avatar

Tasks:

- Profile edit.
- Avatar upload to Convex.
- Avatar display in web/mobile.
- Audit event if security-relevant.

Exit gate:

- Avatar appears in message-ready profile surfaces.

### 12.5 Phase 2: Projects, Groups, Membership

Goal:

- Core access model works before chat/AI.

Depends on:

- Phase 1.

Wave 2.1: Project Create/List

Tasks:

- Create Project mutation.
- Default Group creation.
- Role default Group Membership seeding.
- Project List web.
- Project List mobile.

Exit gate:

- Owner/Admin can create Project.
- Staff/Client cannot.
- Default Groups exist.

Wave 2.2: Group Management

Tasks:

- Group List.
- Create Group.
- Group settings.
- Group Member management.
- Web/mobile Group navigation.

Exit gate:

- Group Membership gates visibility.

Wave 2.3: Invites

Tasks:

- Project invite.
- Group invite.
- Invite acceptance.
- Audit events.

Exit gate:

- Invited user receives only intended Project/Group access.

### 12.6 Phase 3: Conversation Core

Goal:

- Track becomes usable as a group chat.

Depends on:

- Phase 2.

Wave 3.1: Realtime Messages

Tasks:

- Send Message.
- Message pagination.
- Realtime subscriptions.
- Web Conversation UI.
- Mobile Conversation UI.

Exit gate:

- Group Members can chat in realtime on web and mobile.

Wave 3.2: Mentions And Presence

Tasks:

- Mention parsing.
- User mention UI.
- Presence state.
- Typing state.

Exit gate:

- Presence and mentions do not leak restricted Groups.

Wave 3.3: Attachments

Tasks:

- Upload UI web.
- Upload UI mobile.
- Convex storage metadata.
- Access-safe download.
- Extraction status.

Exit gate:

- Attachment visibility follows Message visibility.

### 12.7 Phase 4: Audit And Records Backbone

Goal:

- Records and audit exist before AI writes Draft Records.

Depends on:

- Phase 3.

Wave 4.1: Audit Events

Tasks:

- Append-only audit helper.
- Audit viewer for authorized users.
- Audit tests.

Exit gate:

- Mutating actions write immutable events.

Wave 4.2: Draft Records And Records

Tasks:

- Draft Record model.
- Record model.
- Review/classification mutation.
- Inline Draft Record card web/mobile.
- Project Record list web/mobile.

Exit gate:

- Reviewer can classify Draft Record into Record.

### 12.8 Phase 5: AI Review

Goal:

- Background/manual AI extraction creates Draft Records.

Depends on:

- Phase 4.

Wave 5.1: Manual AI Review

Tasks:

- Manual review action.
- Prompt/input/output schema.
- Evidence citations.
- Draft Record creation.
- AI run observability.

Exit gate:

- Reviewer can run review and see Draft Records inline.

Wave 5.2: Scheduled Incremental Review

Tasks:

- Review cursor.
- Scheduled jobs.
- Durable context input.
- Failure handling.

Exit gate:

- Cursor advances only after successful run.

### 12.9 Phase 6: Track Assistant

Goal:

- Users can ask `@track` evidence-grounded questions inline.

Depends on:

- Phase 4.

Wave 6.1: Invocation And Streaming

Tasks:

- Detect `@track`.
- Create assistant stream.
- Persistent text streaming.
- Web streaming UI.
- Mobile streaming UI.

Exit gate:

- Answer survives reload.

Wave 6.2: Evidence Retrieval

Tasks:

- Permission-safe retrieval.
- Current Group default.
- Optional broadening.
- Evidence links.

Exit gate:

- Assistant cannot leak inaccessible evidence.

Wave 6.3: Draft Creation Offer

Tasks:

- Assistant answer can offer Draft Record.
- Reviewer path can accept/edit.

Exit gate:

- Offer creates Draft Record with evidence.

### 12.10 Phase 7: Notifications

Goal:

- Users receive push notifications with correct preferences.

Depends on:

- Phase 3.

Tasks:

- Web VAPID subscription.
- Expo push token registration.
- Global preferences.
- Per-Group overrides.
- Message notifications.
- Mention notifications.
- Review/export notifications.

Exit gate:

- Group settings override global settings.
- Notifications respect Group Membership.

### 12.11 Phase 8: Export

Goal:

- Project Record can be exported for client/billing support.

Depends on:

- Phase 4.

Tasks:

- Export request UI web/mobile.
- CSV generator.
- Client Summary PDF generator.
- Full Audit Packet PDF generator.
- Export job tracking.
- Convex file storage.

Exit gate:

- Export respects access and filters.
- Client-facing PDF does not reveal restricted Group names.

### 12.12 Phase 9: Observability, Rate Limits, Production

Goal:

- Product is production-operable.

Depends on:

- All earlier phases.

Tasks:

- Axiom client.
- Wide structured events.
- Redaction tests.
- Rate limits.
- Cloudflare deploy.
- Convex dev/prod deploy.
- EAS development builds.
- Store listing content.
- App Store submission.
- Play Store submission.

Exit gate:

- Live web target serves current revision.
- Convex prod is connected.
- Mobile builds succeed.
- Store submission is complete.

## 13. Current Known External Loose Ends

These do not block implementation start:

- Axiom token/dataset access must be provided before real external observability can emit.
- Store listing content and screenshots must be finalized before store submission.
- Play submit service account currently may need production release permission for automated production rollout.

## 14. First Implementation Start Point

Start with Phase 0 remaining tasks, then Phase 1.

Recommended first implementation wave:

```text
Phase 0 / Wave 0.1
  CI + environment wiring + Track shell replacement

Phase 1 / Wave 1.1
  Better Auth Google OAuth + Convex user sync + protected web/mobile shells
```

Do not begin AI Review or Track Assistant before the permission kernel, audit helper, and Record backbone exist.
