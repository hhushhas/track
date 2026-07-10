# Track Product Context

## Product Vision

Track is a shared project communication tool that looks and feels like a normal group chat, but continuously turns the conversation into a structured project record.

The core promise:

> Use chat naturally, and the system continuously turns the conversation into a shared, reviewable project record: decisions, requests, action items, tasks, status, billing-relevant evidence, and timeline.

The product is motivated by a firsthand internal pain: client/vendor work often happens in scattered chat threads, where requests, approvals, changes, and scope discussions are easy to forget. Later, billing and accountability become messy because neither side has a clean memory of who asked for what, when it was discussed, and how it became work.

Track should solve that by making the project remember.

## Product Shape

At the surface level, Track is a multi-project group chat.

Users communicate normally, similar to WhatsApp or Slack. They can sign up, customize profiles, create or join multiple projects, switch between projects, move between groups inside a project, and chat with other group members.

In the background, AI reviews group conversations every configurable interval, plus through a manual "run now" action. The AI reads the conversation and proposes structured records: summaries, timeline updates, action items, tasks, scope changes, blockers, questions, decisions, owners, statuses, and evidence.

These AI-created records are drafts until reviewed by an authorized vendor-side user.

Users can also mention `@track` directly inside a Group conversation for immediate help. This is the conversational assistant surface for asking questions like "is John telling the truth?", "what did we agree on?", "who owns this?", or "summarize the last decision."

## Product Principle

Track should not become a full contract, approval, dispute, or enterprise project-management system.

Track should center one core loop:

1. A user can create or join multiple Projects.
2. Each Project contains Groups for different collaboration contexts.
3. Client and Staff communicate naturally inside selected Groups.
4. AI detects important project-relevant items from a Group's chat.
5. AI creates Draft Records inline inside the Group chat.
6. Authorized vendor-side users review and classify Draft Records.
7. Reviewed Records become part of that Project's Project Record.
8. Client-visible classifications, especially billable ones, appear only where the relevant members have access.
9. Users can mention `@track` inside a Group to ask evidence-based questions about the conversation and records they can access.

## Planned Direction

Records and the Project Record remain the authoritative model for the current application. A future product phase will retire that model in favor of first-class task management organized through Kanban boards.

AI-derived work will become tasks with explicit status, ownership, evidence, and board placement. Chat, source evidence, project and group context, and access controls remain foundational to that system.

Implementation requires a replacement domain model, permission review, and data-migration specification. The current Records schema and workflows remain in force until that specification is approved.

## Core Domain Sentence

A Project is the overall client engagement. A Project contains Groups. Each Group is a focused chat space where selected Staff members and Clients communicate. AI periodically reviews Group Conversations and creates Draft Records. Users can mention `@track` for immediate evidence-based help. Authorized Staff users review Draft Records and classify them into the Project Record.

## Ubiquitous Language

### Project

The overall client engagement.

Users can belong to multiple Projects, but there is no separate organization/workspace layer above projects. Roles and authority live directly inside each project.

Each Project has its own:

- Members.
- Roles.
- Review authority.
- Groups.
- AI Review defaults.
- Draft Records.
- Project Record.

### Group

A focused chat space inside a Project.

Groups are the main permission boundary for messages. Every message belongs to exactly one Group.

Groups allow a project to separate different kinds of collaboration. For example, a developer may need access to delivery discussion but not finance or commercials.

Each Group has its own:

- Members.
- Conversation.
- Messages.
- AI Review settings, or inherited project defaults.
- Draft Records produced from that Group's messages.
- Visibility boundary for records created from that Group.

Default Groups for new projects:

- `general`: shared coordination between Staff and Client.
- `internal`: Staff-only discussion.
- `commercials`: restricted discussion for pricing, scope, billing, invoices, estimates, and commercial decisions.

### Group List

The list of Groups inside a Project.

The Group List is the navigation surface for moving between focused rooms inside the selected Project.

The Group List should show enough operational state to help users choose where attention is needed:

- Group name.
- Visibility hint.
- Unread messages.
- Draft Record count.
- Billable/needs-review count, when the user has access.
- Last activity.

### Group Membership

The explicit list of Members who can see and participate in a Group.

Group Membership is seeded by role defaults, but the actual access boundary is the Group's explicit member list.

Default seeding:

- `general`: Owner, Admin, Staff, Client.
- `internal`: Owner, Admin, Staff.
- `commercials`: Owner and Admin by default, plus explicitly added Staff or Client members.

Project Role gives default access suggestions. Group Membership decides actual access.

### Project List

The user's list of Projects.

The Project List is the navigation surface for switching between projects. It is not an organization/workspace admin layer.

The Project List should show enough operational state to help users choose where attention is needed:

- Project name.
- Client/company label.
- Unread messages.
- Draft Record count.
- Billable/needs-review count.
- Last activity.

### Member

Any person in the project.

### Staff

The vendor/internal side.

### Client

The client-side participants.

### Conversation

The raw chat thread inside one Group.

### Message

A single chat message sent by a project member.

Every Message belongs to exactly one Group.

A Message can mention `@track` to invoke Track Assistant.

### AI Review

A periodic or manual AI analysis pass over the conversation.

AI Review can be run:

- Automatically on a configurable interval.
- Manually through a "Run AI Review" / "Do it now" button.

### Track Assistant

The in-conversation assistant invoked by mentioning `@track`.

The Track Assistant is different from AI Review:

- AI Review runs in the background or by manual trigger and proposes Draft Records.
- Track Assistant responds immediately to a user's question inside the Group conversation.

Example prompts:

- `@track is John telling the truth?`
- `@track what did we agree about the pricing page?`
- `@track who owns the launch checklist?`
- `@track summarize the blockers from today.`
- `@track did the client approve this as billable?`

Track Assistant should answer using only information the requesting user can access.

Track Assistant should cite or link the source messages/Records it used whenever it makes a factual claim. If the evidence is unclear, it should say so instead of pretending certainty.

Track Assistant should sound natural and decisive when the evidence supports it. It can answer with "yes", "no", "partly", or "I do not see enough evidence", then explain briefly with supporting evidence.

Track Assistant should avoid judging intent. For example, it should not say "John is lying." It should say "No, John's claim does not match the record" or "John is overstating it."

By default, Track Assistant answers from the current Group. It may offer to broaden the search to other accessible Groups or Project Records.

Track Assistant answers can optionally create a Draft Record when the answer surfaces a new decision, task, blocker, or scope-relevant item.

### Draft Record

An AI-detected item that has not yet been reviewed by an authorized Staff user.

Draft Records should appear inline in the Group chat, near the messages that caused them.

### Project Record

The official structured history of the project.

The Project Record can include Records from multiple Groups, but each Record keeps its source Group and source message evidence.

### Record

A reviewed item inside the Project Record.

This is the main structured object in the product.

A Record inherits visibility from its source Group by default.

### Record Type

The kind of thing the Record represents.

Initial types:

- Task
- Scope Change
- Decision
- Question
- Blocker
- Note

### Classification

The vendor-side meaning assigned to a Draft Record during review.

Initial classifications:

- Billable
- Included in Scope
- Official Note
- Internal Only
- Needs Clarification
- Ignore

### Reviewer

A Staff-side user allowed to review and classify Draft Records.

Reviewer authority may be project-wide, but it must still respect Group access: a Reviewer cannot review Draft Records from a Group they cannot access.

### Evidence

The source messages that support a Draft Record or Record.

### Source Messages

The exact chat messages the AI used as evidence.

### Official

A Record that has been reviewed and accepted into the Project Record.

### Billable

A classification meaning the item may affect billing.

Billable records are visible to members of their source Group, including client members in that Group.

### Included in Scope

A classification meaning the item is tracked but not separately billable.

### Internal Only

A classification meaning the item is useful for the vendor staff but should not be a client-facing project record.

### Needs Clarification

A classification meaning the item is not ready to become official because the conversation is ambiguous.

### Ignored

A Draft Record that the reviewer decided should not become part of the Project Record.

## Terms To Avoid

Avoid using these as primary product terms:

- Approval: too legally/commercially loaded.
- Acceptance: implies both sides agreed or delivery was committed.
- Audit: useful internally, but can feel adversarial to clients.
- Ticket: sounds like Jira/helpdesk.
- Issue: too bug-tracker flavored.
- Contract: too heavy for Track's current product language.

The preferred flow language is:

- AI detected a Draft Record.
- A Reviewer classifies it.
- It becomes a Record in the Project Record.

## Roles

Roles are project-level only.

There is no organization layer yet. A user's role can differ per project.

Example:

- Owner in `Website Redesign`.
- Staff in `Mobile App Launch`.
- Client in `Vendor Portal`.

### Owner

Vendor-side project owner.

Default capabilities:

- Manage project.
- Manage members.
- Manage Groups.
- Configure AI review settings.
- Review and classify Draft Records.
- Grant review authority to Staff members.

### Admin

Vendor-side project admin.

Default capabilities:

- Manage project operations.
- Invite/manage members, except owner-level controls.
- Manage Groups, if allowed by Owner policy.
- Configure AI review settings.
- Review and classify Draft Records.
- Grant review authority to Staff members, if allowed by Owner policy.

### Staff

Vendor-side project participant.

Default capabilities:

- Chat in Groups where they are a member.
- Request/suggest/create work through conversation.
- Be assigned action items or tasks.
- See project records relevant to the staff.

Staff members cannot review or classify Draft Records unless explicitly granted extra authority.

### Client

Client-side project participant.

Default capabilities:

- Chat in Groups where they are a member.
- Request or suggest work naturally in conversation.
- Provide context and evidence.
- Be assigned follow-ups if needed.
- See client-visible Records, including Billable records.

Clients cannot classify records in the current model.

## Extra Authority

### Can Review AI Records

An extra permission that can be granted to Staff members.

This authority allows a Staff member to:

- Review Draft Records.
- Edit extracted details.
- Classify Records as Billable, Included in Scope, Official Note, Internal Only, Needs Clarification, or Ignore.
- Save reviewed items into the Project Record.

This authority applies only to Groups the reviewer can access.

This single permission covers both record review and billing classification. Splitting billing classification into a separate permission is not part of the current model.

## Role Rules Locked So Far

- Anyone in a Group can communicate normally inside that Group.
- Anyone in a Group can request, suggest, or discuss work inside that Group.
- A user can belong to multiple projects.
- Roles and authority are assigned per project.
- Projects contain Groups.
- Every message belongs to exactly one Group.
- Every Group has its own explicit member list.
- Group Membership is seeded by role defaults.
- Group Membership is the actual access boundary.
- Client messages can create Draft Records.
- Staff messages can create Draft Records.
- Owner and Admin can review/classify Draft Records by default.
- Staff members can only review/classify Draft Records if granted `Can Review AI Records`.
- Review authority must respect Group access.
- Clients cannot review/classify Draft Records in the current model.
- Client-facing billable/official classifications should be visible to clients.
- `@track` can be mentioned by any member inside a Group.
- Track Assistant must respect the requesting user's project and Group access.
- Formal client acknowledgement, questions, or disputes are deferred.

## Record Lifecycle

```text
Group Message(s)
  -> AI Review
  -> Draft Record
  -> Reviewer classification
  -> Record
  -> Project Record
```

Draft Record outcomes:

- Billable
- Included in Scope
- Official Note
- Internal Only
- Needs Clarification
- Ignore

## Inline Review UX

Draft Records should appear inline in the Group chat message area, not only in a separate dashboard.

The Group chat remains the main workspace. The project-management layer emerges as structured checkpoints inside the conversation.

Example:

```text
Group: #commercials

Sarah (Client)
Can we also add a pricing comparison page before launch?

Hasan (Owner)
Yes, but that is extra scope from the current launch checklist.

Sarah (Client)
Understood. Please go ahead and send it with the next invoice breakdown.

AI Project Record
Draft Record Detected

Title: Pricing comparison page
Type: Scope Change
Requested by: Sarah
Evidence: 3 source messages

Classification:
  [Billable]
  [Included in Scope]
  [Needs Clarification]
  [Official Note]
  [Internal Only]
  [Ignore]

[Save as Record] [Edit Details] [View Source Messages]
```

## Track Assistant UX

Track Assistant replies should appear inline as chat messages from `Track`.

Example:

```text
Group: #general

Hasan (Owner)
@track is John telling the truth about us approving the Friday deployment?

Track
I can verify part of that.

Evidence found:
- John said the Friday deployment was approved at 3:14 PM.
- Sarah replied "Friday works if QA passes" at 3:19 PM.
- No Staff reviewer classified this as an Official Record yet.

Answer:
John is not fully accurate. The chat shows conditional agreement, not final approval.

[View Evidence] [Create Draft Record]
```

Assistant behavior rules:

- Answer inside the same Group where `@track` was mentioned.
- Use only Groups, Messages, Draft Records, and Records the requesting user can access.
- Answer from the current Group by default.
- Offer to broaden to other accessible Groups/Project Records when useful.
- Give a direct natural answer when possible: yes, no, partly, or not enough evidence.
- Prefer evidence-based answers over confident judgment.
- Say "I do not have enough evidence" when the conversation does not support a clear answer.
- Link/cite Source Messages for factual claims.
- Avoid judging intent or accusing a person of lying.
- Do not expose restricted commercial/internal context to users outside that Group.
- Offer to create a Draft Record when the answer reveals a decision, task, blocker, or scope-relevant item.

## Visibility Rules

Group Membership is the primary visibility boundary.

Messages are visible only to members of their Group.

Track Assistant answers are visible in the Group where the user mentioned `@track`.

Track Assistant must not use evidence from Groups the requesting user cannot access.

Draft Records are visible only to members who can access their source Group and have the relevant review/view permission.

Records inherit visibility from their source Group by default.

Client-visible:

- Billable
- Included in Scope
- Official Note
- Needs Clarification, when clarification requires client context

Vendor/internal-only by default:

- Internal Only
- Ignore

Billable Records must be visible to client members of the source Group. If a Billable Record comes from a restricted Group, it is visible only to client members who are in that Group.

Records should keep their source Group and source message evidence so users know where the record came from.

## Future Candidate Features

### Client Response Workflow

This is likely important but not part of the current build.

Future client actions on Records, especially Billable records:

- Acknowledge
- Ask Question
- Dispute
- Resolution history

This would create a clearer shared billing trail, but it should not block the current build.

### Split Review And Billing Authority

The current model uses one authority: `Can Review AI Records`.

Later, the product may split this into:

- Can Review AI Records
- Can Classify Billing
- Can Resolve Disputes

### Organization Layer

Track has multiple projects but no organization/workspace layer.

If the product becomes a broader SaaS product, add organizations/workspaces above projects for company-level membership, billing, and shared policy.

## UI Direction

Visual inspiration:

- Vercel
- shadcn/ui
- Calm, dense, useful product UI
- Chat-first, not dashboard-first

Theme:

- Base stone: `#1b1917`
- Accent yellow: `#f0b100`

Design posture:

- Minimal.
- Sharp.
- Work-focused.
- Not playful consumer chat.
- Not enterprise-heavy.
- Not generic purple AI UI.

Primary screens explored so far:

- Project List / project switcher.
- Group List / group switcher inside a selected project.
- Main Group chat with inline Draft Record review.
- Project Record sidebar/summary.
- Member and role settings.
- Group membership/settings.
- AI review settings.
- Mobile chat-first version.

The implemented web and mobile applications are the current UI reference. `DESIGN.md` remains the durable source for visual rules and product semantics.

## Open Product Questions

- What is the minimum Project List state needed: unread count only, Draft Record count, or both?
- Can a client create a project, or are projects created by Staff/Owner only?
- Can Staff members create new Groups, or only Owner/Admin?
- Should `commercials` exist for every project by default, or only when enabled during project setup?
- Should AI Review frequency be configured per project, per Group, or project default with Group override?
- Should the Project Record default to showing all Groups the user can access, with a Group filter?
- What exact fields belong on the first Record object?
- Should summaries/timeline/action items be separate views or projections of Records?
- Should AI Review read the full conversation every time or only new messages since the last review?
- Should `@track` broaden beyond the current Group automatically in specific cases, or only after user action?
- Should Track Assistant replies be able to cite accessible Records across Groups, or only messages from the current Group?
- Should `@track` be available to Clients immediately, or Staff-only first?
- When a Draft Record is edited, should edits be visible as history?
- Should clients see Draft Records before vendor review, or only reviewed Records, within Groups they can access?
- What language should the UI use for "Billable" to be firm but not hostile?
- Should the Project Record be exportable for billing/invoice support in the first build?
