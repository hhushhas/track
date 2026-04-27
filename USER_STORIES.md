# Track User Stories

## Format

```text
Actor -> goal -> outcome
Flow: compact happy path
Accept: minimum proof
```

## Actors

```text
Owner     vendor-side project owner
Admin     vendor-side project admin
Staff     vendor-side participant
Client    client-side participant
Reviewer  Owner/Admin/Staff with Can Review AI Records
Track     AI assistant/system actor
```

## Track Scope

In scope:

```text
Auth + profile + Convex avatars
Projects + Groups + explicit Group membership
Messages + attachments + mentions + presence
@track streaming assistant
AI Review -> Draft Records -> Records
Push notifications with global + per-Group settings
Immutable audit history
Project Record export
Observability
```

Product boundary:

```text
Autonomous AI actions
Cross-Project AI reasoning
Web/mobile feature parity with platform-specific interaction design
```

## 1. Sign In And Secure Account

### US-001 Google Sign In

```text
User -> sign in with Google -> enters Track

[Landing/Login]
      |
      v
[Google OAuth]
      |
      v
[2FA Check]
      |
      v
[Project List]
```

Accept:

- Google OAuth is the only login path.
- User cannot access app without passing required 2FA.
- Profile is created or loaded after first sign-in.

### US-002 Profile Setup

```text
User -> customize profile -> appears correctly in Groups

[Profile Settings]
      |
      v
[Name / Avatar / Display Role]
      |
      v
[Upload Avatar To Convex]
      |
      v
[Messages + Presence]
```

Accept:

- User can update display name and avatar.
- Avatar image is stored in Convex.
- Profile appears in message author, member list, and presence UI.

## 2. Projects

### US-003 Create Project

```text
Owner/Admin -> create project -> default Groups exist

[New Project]
      |
      v
[Name + Client Label]
      |
      v
[Create]
      |
      v
[general] [internal] [commercials]
```

Accept:

- Project appears in Project List.
- Default Groups are created.
- Creator is Owner.
- Group memberships are seeded from role defaults.
- Staff and Client cannot create Projects.

### US-004 Switch Projects

```text
User -> switch project -> sees only accessible state

[Project List]
      |
      v
[Select Project]
      |
      v
[Group List + Last Active Group]
```

Accept:

- Project List shows only joined Projects.
- Each Project row shows unread/draft/needs-review state user can access.

### US-005 Create Group

```text
Owner/Admin -> create Group -> Group becomes available to selected members

[Project Settings]
      |
      v
[New Group]
      |
      v
[Name + Members + Visibility Hint]
      |
      v
[Group Created]
```

Accept:

- Only Owner/Admin can create Groups.
- Staff and Client can request/suggest Groups through chat, not create them directly.
- Created Group has explicit Group Membership.
- Creation writes an audit event.

## 3. Groups And Membership

### US-006 Invite Project Member

```text
Owner/Admin -> invite user -> user joins Project

[Project Members]
      |
      v
[Invite Email/Link + Role]
      |
      v
[User Accepts]
      |
      v
[Project Member Created]
      |
      v
[Seed Default Groups]
```

Accept:

- Inviter chooses role: Admin, Staff, or Client.
- Invite can be accepted only by intended recipient/link holder policy.
- New member is added to role-default Groups.
- Invite and acceptance write audit events.

### US-007 Add Member To Group

```text
Owner/Admin -> add member to Group -> access begins

[Group Settings]
      |
      v
[Add Project Member]
      |
      v
[Group Member Created]
      |
      v
[Group Visible]
```

Accept:

- User must already be a Project Member before Group add.
- Group access starts immediately.
- Membership change writes audit event.
- Only Owner/Admin can change Group Membership.

### US-008 Invite Directly To Group

```text
Owner/Admin -> invite to Group -> Project + Group access created

[Group Settings]
      |
      v
[Invite User + Project Role]
      |
      v
[User Accepts]
      |
      v
[Project Member + Group Member]
```

Accept:

- Useful for adding one Client to `commercials` without exposing other Groups.
- Project role is still required.
- Group Membership is explicit after acceptance.

### US-009 Open Group

```text
Member -> open Group -> reads and sends messages

[Project]
      |
      v
[Group List]
      |
      v
[Group Conversation]
```

Accept:

- User only sees Groups where they are a Group Member.
- Every Message belongs to exactly one Group.

### US-010 Manage Group Members

```text
Owner/Admin -> adjust Group membership -> access changes immediately

[Group Settings]
      |
      v
[Add/Remove Members]
      |
      v
[Audit Event]
      |
      v
[Visibility Updated]
```

Accept:

- Group Membership is explicit.
- Membership changes are immutable audit events.
- Removed users lose access to Messages, attachments, Draft Records, and Records from that Group.

## 4. Conversation

### US-011 Send Message

```text
Member -> send message -> Group updates in realtime

[Composer]
      |
      v
[Message Stored]
      |
      v
[Realtime Group Update]
      |
      v
[Apply Notification Settings]
      |
      v
[Push Notify Eligible Members]
```

Accept:

- Message is visible only to Group Members.
- Message can mention users or `@track`.
- Push notification respects Group Membership.
- Group notification setting overrides global setting.

### US-012 Send Attachment

```text
Member -> attach evidence -> file stays with message

[Composer]
      |
      v
[Attach File]
      |
      v
[Upload]
      |
      v
[Message + Attachment]
```

Accept:

- Images, PDFs, documents, and text files are supported first.
- Attachment inherits Message/Group visibility.
- Attachment can be used as evidence if content extraction is available.

## 5. Track Assistant

### US-013 Ask Track A Question

```text
Member -> @track asks -> Track answers inline

[Group Message: @track ...]
      |
      v
[Permission-Safe Retrieval]
      |
      v
[Stream Answer]
      |
      v
[Evidence Links]
```

Accept:

- Track answers in the same Group.
- Track uses current Group by default.
- Track uses only accessible evidence.
- Answer streams and persists.
- Evidence is cited.

### US-014 Verify A Claim

```text
Member -> asks if claim is true -> gets natural evidence-based answer

"@track is John telling the truth?"
      |
      v
[Extract Claim]
      |
      v
[Find Support / Contradiction]
      |
      v
[Yes / No / Partly / Not enough evidence]
```

Accept:

- Track can answer yes/no when evidence is strong.
- Track avoids intent judgment.
- Track says "not enough evidence" when needed.
- Track may offer to broaden search to accessible Groups/Records.

### US-015 Create Draft From Assistant Answer

```text
Track answer -> record-worthy item found -> create Draft Record

[Assistant Answer]
      |
      v
[Create Draft Record]
      |
      v
[Reviewer Queue]
```

Accept:

- Draft Record keeps source messages and assistant answer.
- Draft is not official until reviewed.

## 6. AI Review

### US-016 Scheduled AI Review

```text
Schedule -> scan Group -> propose Draft Records

[Group Conversation]
      |
      v
[AI Review]
      |
      v
[Draft Records]
      |
      v
[Reviewer Notification]
```

Accept:

- AI Review runs per Group.
- Draft Records cite source Messages/attachments/Records.
- Reviewer notification is pushed only to eligible users.

### US-017 Manual AI Review

```text
Reviewer -> run now -> Draft Records appear inline

[Run AI Review]
      |
      v
[Rate Limit Check]
      |
      v
[AI Review Job]
      |
      v
[Inline Draft Records]
```

Accept:

- Manual review is rate-limited.
- Review respects Group access.
- Run status is visible.

## 7. Draft Records And Review

### US-018 Classify Draft Record

```text
Reviewer -> classify Draft -> Record enters Project Record

[Draft Record]
      |
      v
[Edit Details]
      |
      v
[Choose Classification]
      |
      v
[Save Record]
      |
      v
[Audit Event]
```

Accept:

- Classification options: Billable, Included in Scope, Official Note, Internal Only, Needs Clarification, Ignore.
- Reviewer must have Group access.
- Classification creates immutable audit event.

### US-019 Preserve Evidence

```text
Record -> source evidence -> user can inspect origin

[Record]
      |
      v
[Source Group]
      |
      v
[Source Messages + Attachments]
```

Accept:

- Every Record keeps source Group and source Message IDs.
- Evidence view respects Group access.

## 8. Project Record

### US-020 View Project Record

```text
Member -> open Project Record -> sees accessible Records

[Project Record]
      |
      v
[Filter by Group / Type / Classification / Date]
      |
      v
[Record Detail]
```

Accept:

- User sees only Records from accessible Groups.
- Filters include Group, type, classification, status, date.

### US-021 Export Project Record

```text
Owner/Admin/Reviewer -> export -> receives access-safe file

[Export]
      |
      v
[Select Filters + Format]
      |
      v
[Generate]
      |
      v
[Download + Push/In-App Notice]
```

Accept:

- PDF and CSV are initial formats.
- Export includes evidence when selected.
- Export respects requester access.
- Export job writes audit event.

## 9. Notifications

### US-022 Push Notifications

```text
Event -> eligible users -> push notification

[Message / Mention / Draft / Assignment / Export]
      |
      v
[Access Filter]
      |
      v
[Preference Filter]
      |
      v
[Push Delivery]
```

Accept:

- Web and mobile push are supported.
- Notifications never reveal inaccessible Group content.
- Global preference supports all, mentions, none.
- Per-Group preference supports inherit, all, mentions, none.
- Per-Group setting wins for that Group.
- Delivery attempts/failures are observable.

### US-023 Configure Notification Settings

```text
User -> set global + Group notifications -> receives the right pushes

[Notification Settings]
      |
      v
[Global: All / Mentions / None]
      |
      v
[Group Override: Inherit / All / Mentions / None]
      |
      v
[Effective Setting Per Group]
```

Accept:

- Global setting applies by default.
- Group override takes priority for that Group.
- Mention notifications can be enabled without all-message notifications.
- Muting one Group does not mute every Group unless global setting says so.

## 10. Audit History

### US-024 Immutable Audit Trail

```text
Sensitive action -> append audit event -> never mutate

[Permission Change / Record Classification / Export]
      |
      v
[Audit Event]
      |
      v
[Audit Timeline]
```

Accept:

- Audit events are append-only.
- Events include actor, action, entity, before/after where safe, timestamp.
- Audit events respect viewer access.

## 11. Presence

### US-025 Realtime Presence

```text
User active -> presence visible -> collaborators orient faster

[Open Project/Group]
      |
      v
[Presence Update]
      |
      v
[Online / Typing / Viewing]
```

Accept:

- Presence tracks active Project and Group.
- Typing appears in Group Conversation.
- Presence does not expose inaccessible Group activity.

## 12. Observability

### US-026 Observe System Health

```text
System event -> structured log/event -> debugging proof

[AI / Permission / Export / Push / Rate Limit / Error]
      |
      v
[Observability Event]
      |
      v
[Dashboard/Search Later]
```

Accept:

- AI runs log model, duration, status, token/cost metadata when available.
- Permission denials are traceable.
- Rate-limit hits are traceable.
- Push/export failures are traceable.
- Secrets and unnecessary sensitive content are not logged.

## 13. First Build Slice

```text
Auth
  |
  v
Projects -> Groups -> Messages + Attachments
  |
  v
@track streaming answer
  |
  v
AI Review -> Draft Records -> Review -> Project Record
  |
  v
Export + Audit + Push + Observability
```

Minimum demo path:

```text
Owner signs in
  -> creates Project
  -> invites Staff + Client
  -> chats in #general
  -> uploads attachment
  -> asks @track a claim question
  -> runs AI Review
  -> classifies Draft as Billable
  -> exports Project Record
```
