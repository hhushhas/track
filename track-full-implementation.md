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

Every phase, wave, and task MUST be tracked with:

- `id`
- `depends_on`
- `unlocks`
- `write_scope`
- `parallel_clearance`

### 12.2 Parallelization Vocabulary

Use these exact clearance labels:

| Label | Meaning |
| --- | --- |
| `serial` | Must run alone because it owns shared contracts, schema, auth, routing, or release state. |
| `contract-first` | One worker stabilizes the shared contract first; web, mobile, tests, and docs may parallelize after that contract is accepted. |
| `parallel` | May run alongside other tasks if write scopes do not overlap. |
| `parallel-after` | May run in parallel only after the listed dependency task is merged or explicitly handed off. |
| `read-only` | May run any time because it only inspects, audits, or drafts. |
| `blocked` | Must not start until a missing external dependency is resolved. |
| `deferred-external` | Not required for core product completion; complete when external credentials or services are ready. |
| `deferred-release` | Not required for core product completion; complete when release assets, review inputs, or store permissions are ready. |
| `ship-gated` | Implementation may be completed, but push, production deploy, or public submission requires explicit shipping authorization. |
| `auto-ship` | Push, production deploy, infra provisioning, and app deployment are authorized by the command currently being executed. |

### 12.3 Write-Scope Locks

Parallel workers MUST NOT write to the same lock at the same time.

| Lock | Owns |
| --- | --- |
| `root-config` | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, root tsconfigs, repo scripts. |
| `ci-deploy` | GitHub Actions, Wrangler config, EAS config, deployment scripts. |
| `design-system` | theme tokens, shadcn config, shared UI primitives, app visual shell foundations. |
| `shared-contracts` | `packages/shared`, shared validators, shared constants, shared types inferred from schemas. |
| `convex-schema` | Convex schema, indexes, table contracts, cross-table invariants. |
| `convex-auth` | auth adapter, auth/session functions, TOTP state, user sync. |
| `convex-projects` | Project, Project Member, role, permission helpers. |
| `convex-groups` | Group, Group Member, invite, group visibility helpers. |
| `convex-messages` | Message, attachment metadata, presence, conversation queries/mutations. |
| `convex-records` | Draft Record, Record, audit events, Project Record queries. |
| `convex-ai` | AI Review, Track Assistant, RAG/retrieval, streaming persistence. |
| `convex-notifications` | push subscriptions, notification preferences, delivery jobs. |
| `convex-exports` | export jobs, CSV/PDF generation, export files. |
| `convex-observability` | Axiom client, event emitters, redaction, rate limit wrappers. |
| `web-shell` | web routing shell, layout, auth boundary, providers. |
| `web-feature` | feature screens/components inside `apps/web`. |
| `mobile-shell` | Expo app shell, navigation, auth boundary, providers. |
| `mobile-feature` | feature screens/components inside `apps/mobile`. |
| `docs-spec` | product specs, design docs, execution docs, session logs. |

Rules:

- A wave has exactly one contract owner when it touches `convex-schema`, `shared-contracts`, or auth/session boundaries.
- UI workers may start only after the relevant Convex/shared contract task is accepted or explicitly handed off.
- Tests may run in parallel with UI only when tests do not rewrite the same source files.
- Docs may run in parallel unless the doc is the deliverable being edited.
- If a worker discovers that it must touch another worker's lock, it must stop and report the new dependency.

### 12.4 Dependency DAG

The product dependency graph is:

```text
P0 Foundation
  -> P1 Identity And Security
    -> P2 Projects, Groups, Membership
      -> P3 Conversation Core
        -> P4 Audit And Records Backbone
          -> P5 AI Review
          -> P6 Track Assistant
          -> P8 Export
        -> P7 Notifications
  -> P9 Observability, Rate Limits, Production
```

Important exceptions:

- `W7.1 Push Subscription Infrastructure` may start after `W1.1 Auth Kernel`.
- `W9.1 Observability Foundation` may start after `W0.2 CI And Environment Wiring`.
- `W9.2 Rate Limit Foundation` may start after `W1.1 Auth Kernel`, but feature-specific limits must be added inside their feature waves.
- `W8.1 Export Contract` may start after `W4.2 Draft Records And Records`.

### 12.5 Wave Index

| Wave | Depends On | Unlocks | Parallel Clearance |
| --- | --- | --- | --- |
| `W0.1 Repo Baseline` | none | `W0.2`, `W0.3` | `serial` |
| `W0.2 CI And Environment Wiring` | `W0.1` | `W0.4`, `W9.1` | `parallel` with `W0.3` |
| `W0.3 Track Shell Baseline` | `W0.1` | `W0.4` | `parallel` with `W0.2` |
| `W0.4 Smoke Gates` | `W0.2`, `W0.3` | `W1.1` | `serial` |
| `W1.1 Auth Kernel` | `W0.4` | `W1.2`, `W1.3`, `W2.1`, `W7.1`, `W9.2` | `contract-first` |
| `W1.2 TOTP Enforcement` | `W1.1` | stronger app access gate | `contract-first` |
| `W1.3 Profile And Avatar` | `W1.1` | message identity surfaces | `parallel-after W1.1` |
| `W2.1 Project Create/List` | `W1.1` | `W2.2` | `contract-first` |
| `W2.2 Group Management` | `W2.1` | `W2.3`, `W3.1` | `contract-first` |
| `W2.3 Invites` | `W2.2` | complete membership lifecycle | `parallel-after W2.2` |
| `W3.1 Realtime Messages` | `W2.2` | `W3.2`, `W3.3`, `W4.1`, `W7.2` | `contract-first` |
| `W3.2 Mentions And Presence` | `W3.1` | mention notifications | `parallel` with `W3.3` |
| `W3.3 Attachments` | `W3.1` | attachment evidence | `parallel` with `W3.2` |
| `W4.1 Audit Events` | `W3.1` | `W4.2` | `contract-first` |
| `W4.2 Draft Records And Records` | `W4.1` | `W5.1`, `W6.1`, `W8.1` | `contract-first` |
| `W5.1 Manual AI Review` | `W4.2`, `W3.3` | `W5.2` | `contract-first` |
| `W5.2 Scheduled Incremental Review` | `W5.1` | AI review automation | `parallel-after W5.1` |
| `W6.1 Invocation And Streaming` | `W4.2`, `W3.1` | `W6.2` | `contract-first` |
| `W6.2 Evidence Retrieval` | `W6.1`, `W3.3` | `W6.3` | `contract-first` |
| `W6.3 Draft Creation Offer` | `W6.2`, `W4.2` | assistant-to-record loop | `parallel-after W6.2` |
| `W7.1 Push Subscription Infrastructure` | `W1.1` | `W7.2` | `parallel` with `W2.x`/`W3.x` if locks are disjoint |
| `W7.2 Notification Preferences And Rules` | `W3.2`, `W7.1` | `W7.3` | `contract-first` |
| `W7.3 Notification Delivery QA` | `W7.2`, relevant feature events | notification acceptance | `parallel-after W7.2` |
| `W8.1 Export Contract` | `W4.2` | `W8.2`, `W8.3` | `contract-first` |
| `W8.2 Export Generators` | `W8.1` | `W8.4` | `parallel` with `W8.3` |
| `W8.3 Export UI And Jobs` | `W8.1` | `W8.4` | `parallel` with `W8.2` |
| `W8.4 Export Access QA` | `W8.2`, `W8.3` | export acceptance | `serial` |
| `W9.1 Observability Foundation` | `W0.2` | all feature instrumentation | `parallel` unless touching feature locks |
| `W9.2 Rate Limit Foundation` | `W1.1` | public mutation protection | `parallel` unless touching feature locks |
| `W9.3 Production Deploy` | feature waves complete | store submission | `auto-ship` only when the execution command grants shipping authority |
| `W9.4 Store Submission` | `W9.3` | public mobile release | `auto-ship` when listing assets/content and store permissions are ready; otherwise `deferred-release` |

### 12.6 Phase 0: Foundation

Goal:

- Make the repo executable and deployment-ready.

Status:

- Initial monorepo scaffold exists.
- GitHub repo exists.
- Web and mobile starter apps exist.
- Shared package exists.
- Convex schema skeleton exists.

#### W0.1 Repo Baseline

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T0.1.1` Normalize root scripts and package metadata | none | `root-config` | `serial` |
| `T0.1.2` Confirm TypeScript 6 and shared import aliases | `T0.1.1` | `root-config`, `shared-contracts` | `serial` |
| `T0.1.3` Confirm app package names and path aliases | `T0.1.2` | `web-shell`, `mobile-shell` | `parallel-after T0.1.2` |

Exit gate:

- Root scripts exist for lint, typecheck, test, build, docs, and dev.
- Import aliases work in web, mobile, and shared package.

#### W0.2 CI And Environment Wiring

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T0.2.1` Add GitHub Actions for root gates | `W0.1` | `ci-deploy` | `parallel` with `W0.3` |
| `T0.2.2` Add Cloudflare Worker deployment config | `W0.1` | `ci-deploy` | `parallel` with `T0.2.3` if config files are separate |
| `T0.2.3` Add Convex environment config docs/scripts | `W0.1` | `ci-deploy`, `docs-spec` | `parallel` with `T0.2.2` |
| `T0.2.4` Add EAS config | `W0.1` | `ci-deploy`, `mobile-shell` | `parallel` with web-only work |

Exit gate:

- CI runs the same local gates.
- Cloudflare, Convex, and EAS configs exist without storing secrets in git.

#### W0.3 Track Shell Baseline

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T0.3.1` Create shared design token baseline from `DESIGN.md` | `W0.1` | `design-system`, `shared-contracts` | `contract-first` |
| `T0.3.2` Replace web starter with Track shell | `T0.3.1` | `web-shell`, `web-feature` | `parallel` with `T0.3.3` |
| `T0.3.3` Replace mobile starter with Track shell | `T0.3.1` | `mobile-shell`, `mobile-feature` | `parallel` with `T0.3.2` |
| `T0.3.4` Add baseline empty/loading/error states | `T0.3.2`, `T0.3.3` | `web-feature`, `mobile-feature` | `parallel` by platform |

Exit gate:

- Web and mobile both display the Track shell using the stone/yellow theme.
- The shell has placeholders for Project List, Group List, Conversation, Records, and Profile.

#### W0.4 Smoke Gates

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T0.4.1` Add web smoke test | `W0.2`, `W0.3` | `web-feature` | `parallel` with `T0.4.2` |
| `T0.4.2` Add mobile smoke test | `W0.2`, `W0.3` | `mobile-feature` | `parallel` with `T0.4.1` |
| `T0.4.3` Verify full root gates | `T0.4.1`, `T0.4.2` | none | `serial` |

Exit gate:

- All root gates pass.
- CI runs same gates.
- Web preview starts.
- Mobile Expo start works.

### 12.7 Phase 1: Identity And Security

Goal:

- Users can sign in, pass TOTP, and maintain profile/avatar.

Depends on:

- `P0`.

#### W1.1 Auth Kernel

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T1.1.1` Configure Better Auth Google OAuth | `W0.4` | `convex-auth`, `web-shell`, `mobile-shell` | `contract-first` |
| `T1.1.2` Wire Convex auth integration | `T1.1.1` | `convex-auth`, `convex-schema` | `serial` |
| `T1.1.3` Create user sync path | `T1.1.2` | `convex-auth`, `convex-schema`, `shared-contracts` | `serial` |
| `T1.1.4` Protect web routes | `T1.1.3` | `web-shell` | `parallel` with `T1.1.5` |
| `T1.1.5` Protect mobile routes | `T1.1.3` | `mobile-shell` | `parallel` with `T1.1.4` |
| `T1.1.6` Add auth tests and unauthenticated denial tests | `T1.1.4`, `T1.1.5` | `convex-auth`, `web-feature`, `mobile-feature` | `parallel-after T1.1.5` |

Exit gate:

- Unauthenticated users cannot access app.
- Google login creates/loads user.
- Web/mobile both show authenticated shell.

#### W1.2 TOTP Enforcement

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T1.2.1` Add TOTP enrollment contract | `W1.1` | `convex-auth`, `convex-schema`, `shared-contracts` | `contract-first` |
| `T1.2.2` Add TOTP challenge and enforcement | `T1.2.1` | `convex-auth`, `web-shell`, `mobile-shell` | `contract-first` |
| `T1.2.3` Add backup codes | `T1.2.2` | `convex-auth`, `convex-schema` | `serial` |
| `T1.2.4` Add web TOTP screens | `T1.2.2` | `web-feature` | `parallel` with `T1.2.5` |
| `T1.2.5` Add mobile TOTP screens | `T1.2.2` | `mobile-feature` | `parallel` with `T1.2.4` |
| `T1.2.6` Add enforcement tests | `T1.2.4`, `T1.2.5` | `convex-auth` | `parallel-after T1.2.5` |

Exit gate:

- User cannot access Projects before 2FA requirement is satisfied.

#### W1.3 Profile And Avatar

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T1.3.1` Add profile/avatar schema fields and storage contract | `W1.1` | `convex-auth`, `convex-schema`, `shared-contracts` | `contract-first` |
| `T1.3.2` Add profile edit mutations | `T1.3.1` | `convex-auth` | `parallel-after T1.3.1` |
| `T1.3.3` Add web profile/avatar UI | `T1.3.2` | `web-feature` | `parallel` with `T1.3.4` |
| `T1.3.4` Add mobile profile/avatar UI | `T1.3.2` | `mobile-feature` | `parallel` with `T1.3.3` |
| `T1.3.5` Add profile audit events if security-relevant | `T1.3.2` | `convex-records`, `convex-auth` | `parallel-after W4.1` if audit helper does not exist yet |

Exit gate:

- Avatar appears in message-ready profile surfaces.

### 12.8 Phase 2: Projects, Groups, Membership

Goal:

- Core access model works before chat/AI.

Depends on:

- `W1.1`.
- `W1.2` for production access enforcement.

#### W2.1 Project Create/List

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T2.1.1` Add Project and Project Member schema | `W1.1` | `convex-schema`, `convex-projects`, `shared-contracts` | `contract-first` |
| `T2.1.2` Add Project create/list mutations and queries | `T2.1.1` | `convex-projects` | `parallel-after T2.1.1` |
| `T2.1.3` Add default Group creation hook | `T2.1.2` | `convex-projects`, `convex-groups` | `serial` |
| `T2.1.4` Add web Project List/Create UI | `T2.1.2` | `web-feature` | `parallel` with `T2.1.5` |
| `T2.1.5` Add mobile Project List/Create UI | `T2.1.2` | `mobile-feature` | `parallel` with `T2.1.4` |
| `T2.1.6` Add permission tests for Project creation | `T2.1.3` | `convex-projects` | `parallel-after T2.1.3` |

Exit gate:

- Owner/Admin can create Project.
- Staff/Client cannot.
- Default Groups exist.

#### W2.2 Group Management

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T2.2.1` Add Group and Group Member schema/indexes | `W2.1` | `convex-schema`, `convex-groups`, `shared-contracts` | `contract-first` |
| `T2.2.2` Add Group visibility and membership helpers | `T2.2.1` | `convex-groups`, `convex-projects` | `serial` |
| `T2.2.3` Add Group list/create/settings mutations | `T2.2.2` | `convex-groups` | `parallel-after T2.2.2` |
| `T2.2.4` Add web Group navigation/settings UI | `T2.2.3` | `web-feature` | `parallel` with `T2.2.5` |
| `T2.2.5` Add mobile Group navigation/settings UI | `T2.2.3` | `mobile-feature` | `parallel` with `T2.2.4` |
| `T2.2.6` Add visibility denial tests | `T2.2.3` | `convex-groups` | `parallel-after T2.2.3` |

Exit gate:

- Group Membership gates visibility.

#### W2.3 Invites

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T2.3.1` Add invite schema and acceptance contract | `W2.2` | `convex-schema`, `convex-projects`, `convex-groups`, `shared-contracts` | `contract-first` |
| `T2.3.2` Add Project invite flow | `T2.3.1` | `convex-projects` | `parallel` with `T2.3.3` |
| `T2.3.3` Add Group invite flow | `T2.3.1` | `convex-groups` | `parallel` with `T2.3.2` |
| `T2.3.4` Add web invite UI | `T2.3.2`, `T2.3.3` | `web-feature` | `parallel` with `T2.3.5` |
| `T2.3.5` Add mobile invite UI | `T2.3.2`, `T2.3.3` | `mobile-feature` | `parallel` with `T2.3.4` |
| `T2.3.6` Add invite audit events and tests | `T2.3.2`, `T2.3.3`, `W4.1` | `convex-records`, `convex-projects`, `convex-groups` | `parallel-after W4.1` |

Exit gate:

- Invited user receives only intended Project/Group access.

### 12.9 Phase 3: Conversation Core

Goal:

- Track becomes usable as a group chat.

Depends on:

- `W2.2`.

#### W3.1 Realtime Messages

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T3.1.1` Add Message schema/indexes | `W2.2` | `convex-schema`, `convex-messages`, `shared-contracts` | `contract-first` |
| `T3.1.2` Add send/list/paginate functions | `T3.1.1` | `convex-messages`, `convex-groups` | `parallel-after T3.1.1` |
| `T3.1.3` Add web Conversation UI | `T3.1.2` | `web-feature` | `parallel` with `T3.1.4` |
| `T3.1.4` Add mobile Conversation UI | `T3.1.2` | `mobile-feature` | `parallel` with `T3.1.3` |
| `T3.1.5` Add message visibility and realtime tests | `T3.1.2` | `convex-messages` | `parallel-after T3.1.2` |

Exit gate:

- Group Members can chat in realtime on web and mobile.

#### W3.2 Mentions And Presence

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T3.2.1` Add mention parsing contract | `W3.1` | `shared-contracts`, `convex-messages` | `contract-first` |
| `T3.2.2` Add user mention picker web | `T3.2.1` | `web-feature` | `parallel` with `T3.2.3` |
| `T3.2.3` Add user mention picker mobile | `T3.2.1` | `mobile-feature` | `parallel` with `T3.2.2` |
| `T3.2.4` Add presence and typing state | `W3.1` | `convex-messages`, `web-feature`, `mobile-feature` | `contract-first` |
| `T3.2.5` Add no-leakage tests | `T3.2.1`, `T3.2.4` | `convex-messages`, `convex-groups` | `parallel-after T3.2.4` |

Exit gate:

- Presence and mentions do not leak restricted Groups.

#### W3.3 Attachments

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T3.3.1` Add Attachment metadata schema and storage contract | `W3.1` | `convex-schema`, `convex-messages`, `shared-contracts` | `contract-first` |
| `T3.3.2` Add access-safe upload/download functions | `T3.3.1` | `convex-messages` | `parallel-after T3.3.1` |
| `T3.3.3` Add web attachment UI | `T3.3.2` | `web-feature` | `parallel` with `T3.3.4` |
| `T3.3.4` Add mobile attachment UI | `T3.3.2` | `mobile-feature` | `parallel` with `T3.3.3` |
| `T3.3.5` Add extraction status preservation | `T3.3.1` | `convex-messages` | `parallel-after T3.3.1` |
| `T3.3.6` Add attachment access tests | `T3.3.2` | `convex-messages` | `parallel-after T3.3.2` |

Exit gate:

- Attachment visibility follows Message visibility.
- Screenshots, images, scanned PDFs, and voice notes are preserved as evidence even before OCR/transcription exists.

### 12.10 Phase 4: Audit And Records Backbone

Goal:

- Records and audit exist before AI writes Draft Records.

Depends on:

- `W3.1`.

#### W4.1 Audit Events

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T4.1.1` Add append-only Audit Event schema/helper | `W3.1` | `convex-schema`, `convex-records`, `shared-contracts` | `contract-first` |
| `T4.1.2` Instrument existing mutating actions | `T4.1.1` | `convex-projects`, `convex-groups`, `convex-messages`, `convex-auth` | `serial` unless split by feature owner |
| `T4.1.3` Add audit viewer query | `T4.1.1` | `convex-records` | `parallel-after T4.1.1` |
| `T4.1.4` Add web audit viewer | `T4.1.3` | `web-feature` | `parallel` with `T4.1.5` |
| `T4.1.5` Add mobile audit viewer | `T4.1.3` | `mobile-feature` | `parallel` with `T4.1.4` |
| `T4.1.6` Add immutable audit tests | `T4.1.1`, `T4.1.2` | `convex-records` | `parallel-after T4.1.2` |

Exit gate:

- Mutating actions write immutable events.

#### W4.2 Draft Records And Records

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T4.2.1` Add Draft Record and Record schema/indexes | `W4.1` | `convex-schema`, `convex-records`, `shared-contracts` | `contract-first` |
| `T4.2.2` Add review/classification mutations | `T4.2.1` | `convex-records` | `parallel-after T4.2.1` |
| `T4.2.3` Add Project Record queries | `T4.2.1` | `convex-records` | `parallel` with `T4.2.2` |
| `T4.2.4` Add inline Draft Record card web | `T4.2.2` | `web-feature` | `parallel` with `T4.2.5` |
| `T4.2.5` Add inline Draft Record card mobile | `T4.2.2` | `mobile-feature` | `parallel` with `T4.2.4` |
| `T4.2.6` Add Project Record list web | `T4.2.3` | `web-feature` | `parallel` with `T4.2.7` |
| `T4.2.7` Add Project Record list mobile | `T4.2.3` | `mobile-feature` | `parallel` with `T4.2.6` |
| `T4.2.8` Add classification permission/audit tests | `T4.2.2`, `T4.2.3` | `convex-records` | `parallel-after T4.2.3` |

Exit gate:

- Reviewer can classify Draft Record into Record.

### 12.11 Phase 5: AI Review

Goal:

- Background/manual AI extraction creates Draft Records.

Depends on:

- `W4.2`.
- `W3.3` for attachment evidence inclusion.

#### W5.1 Manual AI Review

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T5.1.1` Define AI Review input/output schemas | `W4.2`, `W3.3` | `shared-contracts`, `convex-ai`, `convex-records` | `contract-first` |
| `T5.1.2` Add manual review action | `T5.1.1` | `convex-ai`, `convex-records` | `parallel-after T5.1.1` |
| `T5.1.3` Add evidence citation creation | `T5.1.2` | `convex-ai`, `convex-records` | `serial` with `T5.1.2` owner |
| `T5.1.4` Add web manual review controls | `T5.1.2` | `web-feature` | `parallel` with `T5.1.5` |
| `T5.1.5` Add mobile manual review controls | `T5.1.2` | `mobile-feature` | `parallel` with `T5.1.4` |
| `T5.1.6` Add AI run observability events | `T5.1.2`, `W9.1` | `convex-ai`, `convex-observability` | `parallel-after W9.1` |
| `T5.1.7` Add manual review tests | `T5.1.3` | `convex-ai`, `convex-records` | `parallel-after T5.1.3` |

Exit gate:

- Reviewer can run review and see Draft Records inline.

#### W5.2 Scheduled Incremental Review

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T5.2.1` Add review cursor contract | `W5.1` | `convex-schema`, `convex-ai`, `shared-contracts` | `contract-first` |
| `T5.2.2` Add scheduled jobs | `T5.2.1` | `convex-ai` | `parallel-after T5.2.1` |
| `T5.2.3` Add durable context input assembly | `T5.2.1` | `convex-ai`, `convex-messages`, `convex-records` | `serial` with AI owner |
| `T5.2.4` Add failure handling and retry state | `T5.2.2`, `T5.2.3` | `convex-ai`, `convex-observability` | `parallel-after T5.2.3` |
| `T5.2.5` Add scheduled review tests | `T5.2.4` | `convex-ai` | `parallel-after T5.2.4` |

Exit gate:

- Cursor advances only after successful run.

### 12.12 Phase 6: Track Assistant

Goal:

- Users can ask `@track` evidence-grounded questions inline.

Depends on:

- `W4.2`.
- `W3.1`.

#### W6.1 Invocation And Streaming

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T6.1.1` Add assistant stream schema/storage contract | `W4.2`, `W3.1` | `convex-schema`, `convex-ai`, `shared-contracts` | `contract-first` |
| `T6.1.2` Detect `@track` in Message flow | `T6.1.1` | `convex-ai`, `convex-messages` | `serial` with message owner |
| `T6.1.3` Add persistent text streaming action | `T6.1.1` | `convex-ai` | `parallel-after T6.1.1` |
| `T6.1.4` Add web streaming response UI | `T6.1.3` | `web-feature` | `parallel` with `T6.1.5` |
| `T6.1.5` Add mobile streaming response UI | `T6.1.3` | `mobile-feature` | `parallel` with `T6.1.4` |
| `T6.1.6` Add stream persistence tests | `T6.1.3` | `convex-ai` | `parallel-after T6.1.3` |

Exit gate:

- Answer survives reload.

#### W6.2 Evidence Retrieval

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T6.2.1` Add permission-safe retrieval contract | `W6.1`, `W3.3` | `convex-ai`, `convex-messages`, `convex-records`, `shared-contracts` | `contract-first` |
| `T6.2.2` Add current Group default retrieval | `T6.2.1` | `convex-ai`, `convex-groups` | `parallel-after T6.2.1` |
| `T6.2.3` Add optional broadening rules | `T6.2.1` | `convex-ai`, `convex-groups` | `serial` with retrieval owner |
| `T6.2.4` Add evidence links in web UI | `T6.2.2`, `T6.2.3` | `web-feature` | `parallel` with `T6.2.5` |
| `T6.2.5` Add evidence links in mobile UI | `T6.2.2`, `T6.2.3` | `mobile-feature` | `parallel` with `T6.2.4` |
| `T6.2.6` Add no-leak retrieval tests | `T6.2.3` | `convex-ai`, `convex-groups` | `parallel-after T6.2.3` |

Exit gate:

- Assistant cannot leak inaccessible evidence.

#### W6.3 Draft Creation Offer

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T6.3.1` Add assistant-to-Draft Record offer contract | `W6.2`, `W4.2` | `convex-ai`, `convex-records`, `shared-contracts` | `contract-first` |
| `T6.3.2` Add reviewer accept/edit path | `T6.3.1` | `convex-ai`, `convex-records` | `parallel-after T6.3.1` |
| `T6.3.3` Add web offer UI | `T6.3.2` | `web-feature` | `parallel` with `T6.3.4` |
| `T6.3.4` Add mobile offer UI | `T6.3.2` | `mobile-feature` | `parallel` with `T6.3.3` |
| `T6.3.5` Add offer audit tests | `T6.3.2` | `convex-ai`, `convex-records` | `parallel-after T6.3.2` |

Exit gate:

- Offer creates Draft Record with evidence.

### 12.13 Phase 7: Notifications

Goal:

- Users receive push notifications with correct preferences.

Depends on:

- `W1.1` for subscription infrastructure.
- `W3.2` for message and mention rules.

#### W7.1 Push Subscription Infrastructure

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T7.1.1` Add push subscription schema | `W1.1` | `convex-schema`, `convex-notifications`, `shared-contracts` | `contract-first` |
| `T7.1.2` Add web VAPID subscription registration | `T7.1.1` | `web-shell`, `convex-notifications` | `parallel` with `T7.1.3` |
| `T7.1.3` Add Expo push token registration | `T7.1.1` | `mobile-shell`, `convex-notifications` | `parallel` with `T7.1.2` |
| `T7.1.4` Add token revoke/update handling | `T7.1.2`, `T7.1.3` | `convex-notifications` | `parallel-after T7.1.3` |

Exit gate:

- Web and mobile can register notification destinations for the authenticated user.

#### W7.2 Notification Preferences And Rules

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T7.2.1` Add global and per-Group preference schema | `W7.1`, `W3.2` | `convex-schema`, `convex-notifications`, `shared-contracts` | `contract-first` |
| `T7.2.2` Add preference queries/mutations | `T7.2.1` | `convex-notifications`, `convex-groups` | `parallel-after T7.2.1` |
| `T7.2.3` Add message notification rules | `T7.2.2` | `convex-notifications`, `convex-messages` | `serial` with notification owner |
| `T7.2.4` Add mention notification rules | `T7.2.2`, `W3.2` | `convex-notifications`, `convex-messages` | `serial` with notification owner |
| `T7.2.5` Add web notification settings UI | `T7.2.2` | `web-feature` | `parallel` with `T7.2.6` |
| `T7.2.6` Add mobile notification settings UI | `T7.2.2` | `mobile-feature` | `parallel` with `T7.2.5` |

Exit gate:

- Group settings override global settings.
- Notifications respect Group Membership.

#### W7.3 Notification Delivery QA

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T7.3.1` Add delivery jobs for message/mention events | `W7.2` | `convex-notifications`, `convex-messages` | `parallel-after W7.2` |
| `T7.3.2` Add review/export notification hooks | `W7.2`, `W5.1`, `W8.3` | `convex-notifications`, `convex-ai`, `convex-exports` | `parallel-after feature owner handoff` |
| `T7.3.3` Add notification permission tests | `T7.3.1`, `T7.3.2` | `convex-notifications` | `parallel-after T7.3.2` |

Exit gate:

- Delivery logic respects user preferences and Group Membership.

### 12.14 Phase 8: Export

Goal:

- Project Record can be exported for client/billing support.

Depends on:

- `W4.2`.

#### W8.1 Export Contract

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T8.1.1` Add export request/job schema | `W4.2` | `convex-schema`, `convex-exports`, `shared-contracts` | `contract-first` |
| `T8.1.2` Add export filter contract | `T8.1.1` | `convex-exports`, `convex-records`, `shared-contracts` | `serial` with export owner |
| `T8.1.3` Add export access rules | `T8.1.2` | `convex-exports`, `convex-groups`, `convex-records` | `serial` with export owner |

Exit gate:

- Export jobs can be requested only for accessible project record data.

#### W8.2 Export Generators

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T8.2.1` Add CSV generator | `W8.1` | `convex-exports` | `parallel` with `T8.2.2` |
| `T8.2.2` Add Client Summary PDF generator | `W8.1` | `convex-exports` | `parallel` with `T8.2.1` |
| `T8.2.3` Add Full Audit Packet PDF generator | `W8.1` | `convex-exports`, `convex-records` | `parallel-after T8.2.2` |
| `T8.2.4` Store generated files in Convex storage | `T8.2.1`, `T8.2.2`, `T8.2.3` | `convex-exports` | `parallel-after T8.2.3` |

Exit gate:

- CSV, Client Summary PDF, and Full Audit Packet PDF can be generated from the same export contract.

#### W8.3 Export UI And Jobs

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T8.3.1` Add export request UI web | `W8.1` | `web-feature` | `parallel` with `T8.3.2` |
| `T8.3.2` Add export request UI mobile | `W8.1` | `mobile-feature` | `parallel` with `T8.3.1` |
| `T8.3.3` Add export job tracking UI web | `W8.1` | `web-feature` | `parallel` with `T8.3.4` |
| `T8.3.4` Add export job tracking UI mobile | `W8.1` | `mobile-feature` | `parallel` with `T8.3.3` |

Exit gate:

- Users can request and retrieve exports from web and mobile.

#### W8.4 Export Access QA

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T8.4.1` Add restricted Group disclosure tests | `W8.2`, `W8.3` | `convex-exports`, `convex-groups` | `serial` |
| `T8.4.2` Add export audit tests | `W8.2`, `W8.3`, `W4.1` | `convex-exports`, `convex-records` | `parallel-after T8.4.1` |
| `T8.4.3` Add visual PDF proof artifacts | `W8.2` | `docs-spec`, `convex-exports` | `parallel-after T8.2.3` |

Exit gate:

- Export respects access and filters.
- Client-facing PDF does not reveal restricted Group names.

### 12.15 Phase 9: Observability, Rate Limits, Production

Goal:

- Product is production-operable.

Depends on:

- `W0.2` for observability foundation.
- `W1.1` for rate limit identity.
- All feature waves for final production release.

#### W9.1 Observability Foundation

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T9.1.1` Add observability sink interface and env contract | `W0.2` | `convex-observability`, `docs-spec` | `contract-first` |
| `T9.1.2` Add no-op/local development sink | `T9.1.1` | `convex-observability` | `parallel-after T9.1.1` |
| `T9.1.3` Add Axiom adapter when credentials exist | `T9.1.1` | `convex-observability`, `docs-spec` | `deferred-external` until Axiom token/dataset exist |
| `T9.1.4` Add wide structured event helper | `T9.1.1`, `T9.1.2` | `convex-observability`, `shared-contracts` | `contract-first` |
| `T9.1.5` Add redaction helper and tests | `T9.1.4` | `convex-observability` | `parallel-after T9.1.4` |
| `T9.1.6` Add feature instrumentation handoff checklist | `T9.1.4` | `docs-spec` | `parallel` |

Exit gate:

- Feature workers can emit operational events through a single redacted helper.
- Core product completion does not require external Axiom emission.
- External Axiom emission is a deferred external-sink gate.

#### W9.2 Rate Limit Foundation

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T9.2.1` Add Convex rate limit component config | `W1.1` | `convex-observability`, `convex-auth` | `contract-first` |
| `T9.2.2` Add generic rate-limit wrappers | `T9.2.1` | `convex-observability`, `shared-contracts` | `parallel-after T9.2.1` |
| `T9.2.3` Add feature-specific limit checklist | `T9.2.2` | `docs-spec` | `parallel` |

Exit gate:

- Public mutations/actions have an obvious rate-limit integration path.

#### W9.3 Production Deploy

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T9.3.1` Prepare and verify Convex dev/prod deploy config | feature waves complete | `ci-deploy` | `serial` |
| `T9.3.2` Prepare Cloudflare Worker deploy config | `T9.3.1` | `ci-deploy` | `serial` |
| `T9.3.3` Create EAS development builds | `T9.3.1` | `ci-deploy`, `mobile-shell` | `serial` |
| `T9.3.4` Push repository changes | full local gates pass | `ci-deploy` | `auto-ship` only when command grants shipping authority |
| `T9.3.5` Deploy Convex production | `T9.3.1`, `T9.3.4` | `ci-deploy` | `auto-ship` only when command grants shipping authority |
| `T9.3.6` Deploy web to Cloudflare Workers at `track.q9labs.ai` | `T9.3.2`, `T9.3.4` | `ci-deploy` | `auto-ship` only when command grants shipping authority |
| `T9.3.7` Create EAS production builds | `T9.3.3`, `T9.3.4` | `ci-deploy`, `mobile-shell` | `auto-ship` only when command grants shipping authority |
| `T9.3.8` Verify live revision and mobile build boot | `T9.3.5`, `T9.3.6`, `T9.3.7` | none | `serial` |

Exit gate:

- Repository changes are pushed when shipping authority is granted.
- Convex prod is connected and serving the current revision.
- `track.q9labs.ai` serves the current web revision.
- Mobile production builds succeed.
- Live proof is captured in the handoff.

#### W9.4 Store Submission

This wave is part of full auto-ship when listing assets/content and store permissions are ready. It is deferred only when those assets, content, or permissions are missing.

| Task | Depends On | Write Scope | Parallel Clearance |
| --- | --- | --- | --- |
| `T9.4.1` Finalize store listing content and screenshots | `W9.3` | `docs-spec`, `ci-deploy` | `deferred-release` until listing assets/content are ready |
| `T9.4.2` Submit App Store build | `T9.4.1` | `ci-deploy` | `auto-ship` with shipping authority; parallel with `T9.4.3` if credentials are stable |
| `T9.4.3` Submit Play Store build | `T9.4.1` | `ci-deploy` | `deferred-release` if Play production release permission is not granted |
| `T9.4.4` Verify store submission status | `T9.4.2`, `T9.4.3` | none | `serial` |

Exit gate:

- App Store submission is complete.
- Play Store submission is complete.

### 12.16 Parallel Worker Clearance Pattern

For a normal feature wave after the contract task lands, use this split:

```text
Worker A: Convex/shared contract and backend behavior
  locks: convex-*, shared-contracts

Worker B: Web UI
  locks: web-feature

Worker C: Mobile UI
  locks: mobile-feature

Worker D: Tests, docs, observability
  locks: feature test files, docs-spec, convex-observability
```

Do not start Workers B/C/D until Worker A has either:

- committed the contract,
- produced a stable patch,
- or written an explicit handoff with function names, schema fields, validators, and expected states.

### 12.17 Conflict Prevention Protocol

Before starting any worker:

1. Read the target wave and task IDs.
2. Claim the write-scope locks in the worker prompt.
3. Confirm no other active worker owns those locks.
4. Include `depends_on` and `unlocks` in the worker prompt.
5. Require the worker to list changed files in the final response.

Before merging any worker output:

1. Re-run `git status --short`.
2. Review changed files against the claimed write-scope locks.
3. Reject or rework output that silently touched another worker's lock.
4. Run the wave exit gate.
5. Update the session log with the completed task IDs.

### 12.18 Execution Command Semantics

If Hasan says `execute phases 1-9 end-to-end until full completion`, the executor MUST understand that as a full auto-ship command.

It means:

- Complete every non-deferred task in `P1` through `P9`.
- Complete any missing `P0` prerequisite that blocks `P1`.
- Preserve web/mobile feature parity for every user-facing capability.
- Keep backend/shared contracts ahead of web/mobile UI work.
- Use the dependency IDs and write-scope locks in this file to avoid worker conflicts.
- Run the wave exit gate before advancing to the next dependent wave.
- Commit scoped completed work as it lands.
- Push committed work.
- Monitor CI and fix failures until green or truly blocked.
- Provision or update infrastructure as needed.
- Deploy Convex production.
- Deploy web live to `track.q9labs.ai`.
- Create and deploy mobile app builds through Expo/EAS as far as credentials, store assets, and store permissions allow.
- Use authenticated browser/console workflows when CLI/API automation is insufficient.
- Verify live proof before final handoff.

Authorized tools and accounts for full auto-ship:

- CLI tools: `gh`, `wrangler`, `convex`, `eas`, and other configured repo tooling.
- Browser/desktop tools: Computer Use and the authenticated Helium Browser.
- Allowed consoles: Expo, App Store Connect, Apple Developer, Google Play Console, Google Cloud, Convex, Cloudflare, GitHub, and related Track deployment consoles.
- Required console account: switch to or confirm `q9labs.ai@gmail.com` before console changes.
- If the browser is on another account, switch accounts before making changes.

It must stop only for true blockers:

- Missing credentials or missing account access.
- Any destructive action that risks data loss.
- Payment, legal, tax, or account-ownership decisions.
- Store listing assets/content that cannot be generated or finalized yet.
- Play production release permission if production Play submission is impossible.
- Security-sensitive scope expansion not already described in this file.

That command does NOT mean:

- Skip testing because the scope is large.
- Start AI Review or Track Assistant before permissions, audit, and records are ready.
- Treat external Axiom emission as required before product completion.
- Pretend App Store/Play Store submission succeeded if listing assets/content or permissions are missing.
- Attempt store submission without final listing content/screenshots.
- Attempt Play production rollout without the required Play permission.
- Make console changes under the wrong Google/Apple/Expo account.

Core product completion means:

- Auth, TOTP, Projects, Groups, invites, chat, attachments, presence, audit, records, AI Review, Track Assistant, notifications, exports, rate limits, and production deploy path are implemented.
- Web and mobile have parity for the same product capabilities.
- Observability emits through the internal redacted helper and can use a no-op/local sink until Axiom credentials are available.
- Full local gates pass.
- The latest committed revision is pushed when the full auto-ship command is active.
- Production deploy is complete when the full auto-ship command is active.

Release completion means:

- External Axiom emission is configured and verified.
- Store listing content/screenshots are finalized.
- App Store submission is complete.
- Play Store submission is complete.

## 13. Current Known External Loose Ends

These do not block product implementation or live product deployment:

- Axiom token/dataset access is only required before real external Axiom emission can be verified.
- Store listing content and screenshots are only required before App Store/Play Store submission; they can be deferred until the product is built enough to generate final screenshots.
- Play submit service account production release permission is only required before automated Play production rollout.

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
