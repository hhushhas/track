# Task Management Specification

Status: approved product direction; implementation pending.

This specification defines the first-class task-management release in Track's
target [PRODUCT.md](./PRODUCT.md) contract. The running product is summarized in
[README.md](../README.md) until this work passes its release gate. The release
combines Channel conversation, permission-aware references, multiple Kanban
boards, and human-controlled AI task suggestions in one workspace.

Discord-style Channel threads are governed independently by
[THREADS_SPEC.md](./THREADS_SPEC.md). Neither release depends on the other; the
thread compatibility rules below apply when both features are enabled.

## Product intent

Track should let a team move from discussion to accountable work without
copying context into another product. A person can create a task directly,
convert a message or assistant answer into a task, or accept a task suggestion
that Track detected in conversation. Every chat-derived task remains connected
to the evidence that produced it.

The interaction should feel like conversation and task planning are views of
the same Project. Conversation remains optimized for reading and composing.
Boards, lists, and task details provide the structure needed to plan and finish
work.

## Goals

- Make tasks durable Project objects with ownership, workflow, priority, due
  date, comments, subtasks, labels, activity, and references.
- Support multiple boards with independent workflows at Project or Channel scope.
- Let people create tasks from the task surface, a Channel conversation, a
  source message, or an assistant answer.
- Detect high-confidence action items in new Channel conversation and place
  grounded task suggestions in a shared suggestion inbox.
- Let an authorized person explicitly scan Project- or Channel-scoped imported
  memory into suggestions of the same scope.
- Keep a person in control of every durable task created from AI output.
- Preserve Track's Channel membership boundary in every query, mutation, search
  result, notification, AI run, deep link, and inline task card.
- Deliver full board planning on web and essential create, review, update, and
  comment workflows on mobile.
- Add measurable product signals for adoption and suggestion quality without
  sending message or task content to analytics.

## First-release exclusions

The first release excludes epics, initiatives, sprints, cycles, estimates,
dependencies, custom fields, time tracking, recurring tasks, workflow
automation, external Jira/Linear synchronization, guest accounts, direct file
uploads to tasks, cross-Project boards, direct messages, and Channel-thread
creation or management. Task comments can link existing conversation evidence;
task-specific attachments can follow in a later release.

The task model has no Record, Draft Record, AI review, or record-export
semantics. The task suggestion inbox contains only proposed tasks.

The supported task origins are manual creation, a source message, a completed
assistant answer, and an accepted task suggestion. The implementation keeps the
removed draft/review UI, routes, tables, functions, and language absent. Any
historical deployment data governed by an earlier model stays outside this
feature and follows its separately approved retention or deletion plan.

## Canonical language

- **Task**: a durable work item created or confirmed by a person.
- **Subtask**: a task with one parent task. The first release supports one level
  of nesting.
- **Board**: an ordered collection of workflow states and tasks with one access
  scope.
- **Workflow state**: a board-specific task status rendered as a Kanban column.
- **State category**: the stable semantic meaning of a workflow state:
  `backlog`, `unstarted`, `started`, `completed`, or `canceled`.
- **Task suggestion**: an AI-proposed task grounded in one Project or Channel
  scope. A suggestion becomes a task only when a person accepts it.
- **Suggestion inbox**: the shared list of pending task suggestions visible to
  members authorized for each suggestion's Project or Channel scope.
- **Reference**: a message, attachment, assistant answer, or imported-memory
  excerpt that supports a task or suggestion. A thread message uses its parent
  Channel's scope when threads are enabled.
- **Project-scoped**: visible to every active Project member and through an
  authorized read-only archive after Company exit.
- **Channel-scoped**: visible only to members authorized for one Channel.
- **Task administrator**: a legacy project owner/admin or a company-model
  Project manager. Channel administration also requires Channel access.
- **Full task collaborator**: a legacy staff member with active access to the
  task scope. Company-model members use scoped collaboration.
- **Scoped task collaborator**: a legacy client or a company-model Project
  member who can create work and edit tasks they created or are assigned.
- **Task activity**: the user-facing history of comments and meaningful task
  changes.

Use “task,” “subtask,” “board,” “workflow state,” and “task suggestion” in UI
copy. Use “status” as the user-facing label for a workflow state when space is
limited.

## Company-model compatibility

The companion
[Company Relationships and Shared Projects specification](./COMPANY_RELATIONSHIPS_SPEC.md)
is authoritative for Company identity, Acting Company, neutral Project roles,
Channel naming, participation, exit, archive access, and migration. Task
management uses that policy when a Project activates the company model.

The current product stores and displays Channels as Groups. A task-only release
may continue that legacy product label until the Company migration ships. New
task policy uses one logical Channel scope backed by the existing `groups` and
`groupMembers` records during compatibility. It creates no parallel Channel
table, membership system, or content boundary.

One central Project/Channel policy adapter returns the authenticated actor's
Project membership, Acting Company where applicable, Channel membership,
active or read-only access mode, and task capabilities. Every task query,
mutation, search, notification, AI job, report, audit read, and deep link uses
that adapter. Feature code contains no scattered legacy-role or
`companyId ?? legacy` branches.

The policy profiles are:

- **Legacy Project**: current `owner`, `admin`, `staff`, and `client` roles plus
  exact Group membership drive the legacy permission matrix below. The UI uses
  Group until that Project completes its guided Company upgrade.
- **Company-model Project**: active `manager` and `member` Project roles plus
  exact Channel membership drive the neutral permission matrix below. Company
  roles and Relationship participation grant no task access. Every write stores
  the actor's Project membership and Acting Company.
- **Exited or archived participation**: the authorized historical task,
  comment, activity, and evidence snapshot is read-only. Detection, suggestions,
  reminders, notifications, comments, assignments, and every other task write
  stop for that participant.

A task release can ship on the legacy profile while the Company model remains
future work. A release that enables both models must pass the reconciliation
criteria in both specifications. New implementation choices must remain
forward-compatible with the neutral profile and archive policy from Phase 0.

## Information architecture

Each project gains a **Tasks** destination beside its Channels. It contains:

- **Inbox**, showing accessible pending task suggestions;
- **My tasks**, combining tasks assigned to the selected Project membership
  across accessible boards;
- **All tasks**, a filterable list of accessible tasks;
- **Boards**, with a board switcher and Kanban or list view.

The Tasks header also exposes a per-Project-membership task notification feed.
Its unread badge counts authorized notification rows whose `readAt` is empty.
The Inbox badge separately counts accessible pending suggestions that the
selected Project membership has not hidden; it represents pending work rather
than read state.

Project-wide boards appear to every active Project member. Channel boards appear
only to members of their Channel. A user may therefore see a different board
switcher, inbox count, and My tasks result set than another member of the same
Project. Former Company participants use a separate read-only archive surface
containing only the Project and Channels they were authorized to retain at exit.

Every task surface operates under one selected Project membership and, for a
company-model Project, its Acting Company. A deep link that the same user could
open through two Company memberships uses its encoded Acting Company context or
asks the user to choose one before loading data. My tasks, Inbox hides, follow
state, task preferences, notifications, unread counts, and archive reads never
union those memberships.

Web opens task details in a routable right-side drawer over the current board,
list, or conversation. Reload, browser history, and copied deep links preserve
the selected task. Mobile opens the same task as a full screen.

Each Channel conversation gains an open-task count and a compact task panel. The
panel lists open tasks scoped to that Channel and provides a path to its default
board. Conversation remains the primary surface while the panel or a task
drawer is open.

## Boards and workflow states

### Board scope

A board is either project-scoped or bound to exactly one Channel. Board scope is
immutable after creation. A task administrator who can access the scope may create,
rename, reorder, archive, and restore boards.

A project can have multiple project boards and multiple boards for the same
Channel. A scope with one or more active boards has exactly one default board. A
scope with no active boards has no default. Creating the first board assigns it
as default. Changing a default or archiving the current default selects the
replacement in the same transaction.

Track provisions boards lazily:

- the first project-scoped task creates a project board named **Project tasks**
  when no eligible board exists;
- the first accepted or manually created Channel task creates **{Channel} tasks**
  when no eligible Channel board exists;
- system provisioning uses the standard workflow and grants no board-management
  authority to the triggering user.

Lazy provisioning is an atomic get-or-create operation keyed by project and
optional Channel scope. The mutation serializes concurrent first-task requests,
creates the board and standard workflow together, and returns the one active
default. It cannot create competing defaults or a board without valid states.

The standard workflow is Backlog, To do, In progress, Done, and Canceled. The
first four states map to their corresponding semantic categories; Canceled maps
to `canceled`.

### Workflow rules

Each board owns its workflow states. Names and order are configurable, while
state categories remain one of the five canonical values. Every active board
must have a default nonterminal state and at least one `completed` state.

A workflow state with tasks cannot be removed until an authorized user selects
a replacement state. Track moves the affected tasks and records the change in
one server transaction. A task entering a `completed` or `canceled` state gains
a terminal timestamp. Reopening it clears that timestamp.

Kanban order is server-authoritative. Each task has an opaque sortable rank
within its workflow state. Move and reorder mutations allocate ranks and
rebalance safely; clients never calculate permanent order from array indexes.

Moving a task to another board is allowed only between boards with the same
scope. Task administrators and full task collaborators can perform that
transfer. The destination
board's default state is selected unless the user explicitly chooses another
valid state.

Archiving a board removes it from normal navigation and preserves its tasks,
activity, comments, and evidence. An archived board cannot be a default or
receive new tasks. Normal product flows use archive and restore rather than
hard deletion.

## Task model and behavior

Every task belongs to one project, one board, and one workflow state. It has:

- an immutable opaque public key displayed as `T-7K4M2P9Q`;
- a required title and optional Markdown description;
- one optional assignee;
- priority: `none`, `urgent`, `high`, `medium`, or `low`;
- an optional date-only due date stored as `YYYY-MM-DD`;
- zero or more project labels;
- zero or more reference links, with one optional primary reference;
- a creator, followers, comments, and user-facing activity;
- an optional parent task;
- created, updated, terminal, and archived timestamps.

Task keys use cryptographically random Crockford-style characters, are unique
within a project, and are never reused. They reveal no project or Channel task
volume. Search and task links recognize a full task key in project context.
Copied routes use the opaque task key and resolve it through an authorized
project query.

The workflow state is the task's status. There is no parallel status field. The
state category drives completed, canceled, open, and overdue behavior so custom
state names cannot break product logic.

The due date represents the named calendar date. Track evaluates overdue and
due-soon state in the viewing or receiving user's timezone. The first release
has no due time.

An assignee is one exact Project membership rather than a bare user. The
membership must be active, and a Channel-scoped task requires active membership
in that Channel. A multi-Company user's choices display their Company so the
assigner selects the intended membership. Removing or exiting that membership
clears the assignment, preserves activity attribution, and notifies the task's
remaining followers where permitted.

Labels are project-owned so the same label can be reused across boards. Task
administrators manage the project label catalog. Other authorized editors can apply
existing labels.

### Subtasks

A subtask uses the same task table and fields as a top-level task. It inherits
its parent's project, board, and access scope. A subtask cannot have a child.
Moving the parent to another same-scope board moves its subtasks in the same
transaction and maps each one to the destination's default state.

Parent and subtask completion remain independent. Completing a parent with open
subtasks requires confirmation and leaves those subtasks unchanged. Archiving a
parent archives its subtasks; restoring the parent offers to restore them.

### Scope changes

Task scope normally matches its creation context:

- a task created from a Channel message, Channel assistant answer, Channel panel,
  or Channel task suggestion starts Channel-scoped;
- a task created from a Project task surface uses the selected board's scope;
- a subtask inherits its parent's scope.

A task administrator who is also a member of the source Channel can promote a
Channel-scoped task to project scope. Promotion requires an explicit confirmation
that names the current fields becoming visible: task key, title, description,
creator, assignee, priority, due date, labels, workflow state, and subtask
fields. In a company-model Project it also names every Company and person that
will gain access. Promotion requires a destination project board. References and
pre-promotion comments and activity retain their original Channel access rule.
Project members outside that Channel see an “Earlier context is restricted”
indicator without Channel names, authors, quotes, filenames, event types, counts
that reveal hidden activity, or deep links.

A task administrator can narrow a project-scoped task to a Channel they belong to.
The confirmation lists members who will lose access. Track selects an eligible
Channel board, removes followers who lack Channel access, and clears an ineligible
assignee in the same transaction. Both scope-change flows apply to the task and
all of its subtasks atomically. They map each task to a valid destination state,
revalidate every assignee and follower, and cover every affected task in the
confirmation.

Every scope change creates task activity and a project audit event.

### Comments, followers, and activity

Task comments support Markdown and mentions of exact Project memberships that
can access the task. The UI shows a Company badge where one user has multiple
eligible memberships.
An author can edit a comment; edited comments show an edited marker and create a
safe audit event. A comment can be archived by its author or a task administrator. The
first release links existing references and has no direct task-comment file upload.

Every comment and activity item stores the task's access scope at the moment it
is created. Reads require access to both the task's current scope and the item's
immutable original scope. Promotion therefore exposes current task fields and
new project-scoped discussion while preserving earlier Channel discussion. Edit,
archive, search, notification, report, audit, and deep-link functions apply the
same two-scope check.

The creator and assignee follow a task automatically. A commenter follows it
after their first comment unless they opted out. Any task viewer can follow or
unfollow explicitly. Assignment always produces an important notification even
when the new assignee was not previously following.

Follower relationships are private notification preferences. The UI shows the
selected Project membership's follow state and exposes no follower list or
follower count to other task viewers.

Task activity shows comments and meaningful changes to status, assignee,
priority, due date, title, description, labels, board, scope, and archive state.
Routine rank changes inside one workflow state do not create noisy activity.
Security and administrative audit events remain available through the existing
project audit surface.

## Conversation integration

### Thread compatibility

Task management does not create or manage Channel threads. When the independent
thread feature is enabled, a thread message behaves as a Channel message for
task purposes: **Create task**, inline cards, linked-source navigation, evidence
invalidation, automatic detection, and bounded history scans use the parent
Channel's scope. Detection may use whole-Channel context, including threads, as
defined by [THREADS_SPEC.md](./THREADS_SPEC.md).

These combined behaviors are release-gating only when both feature flags are
enabled. A task-only release works with Channels that have no thread records,
and a thread-only release introduces no task dependency.

### Human-created tasks

Every message and completed assistant answer has a **Create task** action. It
opens a prefilled task form with the source attached as evidence. The person can
edit all permitted fields and creates the durable task by submitting the form.
Manual task creation remains available from every task list and board.

The task form lists boards compatible with the source scope. Assignee choices
contain only users allowed by that scope. The form never offers a project board
for a Channel-scoped source until an authorized user explicitly performs the
promotion flow.

### Live inline cards

An accepted or manually created chat-derived task renders a live compact card
under its primary source message or assistant answer. The card shows task
key, title, current workflow state, assignee, and due state. Convex updates
it reactively when those fields change.

Secondary source messages show a small linked-task indicator and open the same
task drawer. Routine task changes create no assistant-authored chat messages.
A person can intentionally share a task into chat; that human-authored message
contains a live link preview.

Inline cards follow the viewer's current permissions. Losing Channel or project
access removes the card and its metadata on the next reactive update. An
unauthorized deep link returns a generic unavailable state without confirming
that the task exists.

Evidence quotes and preview metadata are invalidatable derived caches. Every
active read resolves the live source and checks its current Project/Channel
policy before returning a quote, filename, author, link, or inline card. Archive
reads resolve the source and bounded snapshot through the exact exit-time
entitlement. A delayed cleanup job therefore cannot make a stale snapshot
readable.

Deleting, redacting, expiring, or revoking a message, attachment, assistant
answer, or imported-memory source purges its cached quote and preview and removes
its source-side card or indicator. The task retains only a generic unavailable
source tombstone when audit retention requires one. An authorized security,
legal, privacy, or retention redaction also invalidates affected archive
snapshots. Evidence snapshots never enter task search indexes.

## AI task suggestions

### Human authority

AI creates task suggestions. Accepting a suggestion creates the durable task in
one audited transaction. The acceptance form lets the reviewer edit the title,
description, board, state, assignee, priority, due date, labels, and evidence.
The server derives the new task's Project or Channel scope from the suggestion
and accepts only an active board with that exact scope. Acceptance cannot change
scope. A task administrator can use the task scope-change flow after acceptance.

Track never changes a committed task field from automatic inference. Explicit
assistant actions may propose an edit or a follow-up task and require a person
to confirm it.

An explicit task intent such as `@track create a task for this` creates a task
suggestion and returns a concise assistant acknowledgement linked to that
suggestion. The assistant asks for clarification when it cannot identify
grounded work. Ordinary `@track` questions continue through the answer flow.

### Automatic detection

Automatic detection is enabled by default for new and existing Channels when the
task feature becomes active. Task administrators who belong to the Channel can turn
it off for that Channel. The setting explains that eligible message content is
sent to the configured model provider. Turning it off leaves manual **Create
task** and explicit `@track` requests available.

After a human message is committed, Track schedules a coalesced Channel
detection run. A short debounce window lets one discussion turn settle and
prevents one model call per message. Each run receives a bounded window of new
Channel messages and reply context since the last successful checkpoint.

Detection settings carry a monotonically increasing generation and a
high-water message cursor. Initial activation and every re-enable set the cursor
to the latest committed message, so messages from before activation or while
detection was disabled require an explicit history scan. Disabling increments
the generation and cancels scheduled work on a best-effort basis.

A run records its expected generation, start cursor, and bounded end cursor and
acquires one expiring lease for the Channel. Immediately before prompt
construction and the provider request, it rechecks that the Channel exists, the
Project and Channel remain active and writable, the setting remains enabled,
and the generation and start cursor still match. A stale run exits without
sending data. A provider request already in flight when the setting or lifecycle
changes may finish, and its result is discarded; the settings copy states this
in-flight boundary.

Candidate persistence and checkpoint advancement happen in one internal
mutation that compares the expected generation and cursor. Success writes all
validated candidates and advances exactly to the run's end cursor. Failure
advances nothing and uses bounded idempotent retries. New messages beyond the
end cursor remain for a later run. Expired leases can be reclaimed without
allowing two runs to commit the same window.

Automatic detection uses only evidence from that Channel. It excludes other
Channels, Project-scoped memory, hidden attachments, task content from another
scope, and analytics data. Attachment text may be used only when the attachment
belongs to the same Channel and its extraction passed existing safety limits.

The model returns validated structured candidates containing:

- proposed title and description;
- proposed assignee, priority, and due date when directly supported;
- a primary reference and supporting references;
- confidence and a short grounding reason;
- an optional likely-duplicate task reference.

Server code validates every identifier and field against current membership,
scope, and evidence before persisting a candidate. Detection runs retain only
an aggregate low-confidence count; rejected candidate text is discarded and
never enters the suggestion inbox. Confidence thresholds are operational
configuration rather than user-facing controls.

### Deduplication

Track computes a deterministic fingerprint from the suggestion scope, source
message or import-excerpt set, and normalized candidate. The fingerprint remains
unique across pending and terminal suggestion states, which prevents job retries
or later scans from recreating a decided suggestion. A candidate may resurface
only when it cites materially new evidence; the new evidence set produces a new
fingerprint and remains subject to semantic duplicate review.

Channel detection compares a candidate with Project-scoped and same-Channel
open tasks and pending suggestions. It never compares against another Channel's
work. A Project-scoped imported-memory scan compares only with Project-scoped
open tasks and Project-scoped pending suggestions, so its broadly visible result
cannot reveal restricted Channel work. A likely semantic duplicate is marked
for review and linked to the existing task. Track offers **Open existing**,
**Add evidence to existing**, and **Create separately**. A person chooses the outcome; the system performs no automatic
merge.

Suggestion status follows one server-enforced state machine:

- `pending → accepted(taskId)` creates a task, including **Create separately**
  with a recorded duplicate override;
- `pending → linked(taskId)` adds the authorized new evidence to an existing
  task and creates no task;
- `pending → dismissed(reason)` records a shared decision and creates no task;
- **Open existing** only navigates and leaves the suggestion pending;
- **Hide for me** writes per-Project-membership hidden state and leaves the
  shared status pending.

Every terminal transition accepts an idempotency key and conditionally updates
only a pending suggestion. Concurrent or repeated calls return the recorded
terminal result. Linking references also verifies that the actor may edit the
target task and that each reference is compatible with its scope.

### Suggestion inbox

The shared inbox shows Project-scoped pending suggestions and Channel-scoped
pending suggestions where the current Project membership has active write
access. Each row shows the proposed title, source scope, evidence preview,
proposed assignee and due date, possible duplicate, and detection time. Filters
include scope, Channel, board destination, assignee, duplicate state, and age.

Task administrators and full task collaborators can accept, edit, or dismiss
any suggestion they can access. Scoped task collaborators can accept a
suggestion into a task they are allowed to create. They can dismiss suggestions
grounded primarily in their own message and can hide other suggestions for
themselves. Dismissal records an optional reason: `not_actionable`, `duplicate`,
`wrong_details`, `sensitive`, or `other`.

Concurrent reviewers receive the recorded accepted, linked, or dismissed
result when one reviewer wins. Terminal suggestions leave the pending inbox and
retain their decision history with the project. They have no general AI review
semantics.

Archive state is orthogonal to suggestion status. A task administrator can
archive or restore an accessible suggestion without changing its pending or
terminal decision. Archived pending suggestions leave the Inbox. Project
archive freezes every suggestion under the shared lifecycle transaction.

Suggestion creation produces an inbox badge and no push notification. An
explicit `@track` task request notifies its requester when the suggestion is
ready or failed.

### Historical conversation and imported memory

Feature activation starts detection with new messages. Track performs no
automatic historical backfill.

A task administrator who belongs to a Channel can explicitly run **Find tasks in
history** for a bounded date range.

Imported-memory scans are also explicit and require a traceable memory import,
its declared Project or Channel scope, and bounded excerpts. A Project-scoped
import creates Project-scoped suggestions accepted only into Project boards. A
Channel-scoped import creates suggestions for that Channel and requires the
administrator to belong to it. Both flows use the same human review, evidence,
deduplication, and permission rules. Content without a provable source scope is
skipped and reported as unavailable for task extraction.

## Permissions

Administrative authority never grants access to a Channel. Every Channel board,
task, suggestion, comment, activity item, and reference requires the
actor's current Channel membership or their authorized read-only archive
membership in addition to the capability rule.

### Legacy Project matrix

Legacy Projects keep `owner`, `admin`, `staff`, and `client` until guided
Company migration. The task policy for that period is:

| Action | Owner/admin | Staff | Client |
| --- | --- | --- | --- |
| View project-scoped boards and tasks | Yes | Yes | Yes |
| View Channel boards, tasks, suggestions, and evidence | With Channel membership | With Channel membership | With Channel membership |
| Create a task on an accessible board | Yes | Yes | Yes |
| Accept an accessible task suggestion | Yes | Yes | Yes, subject to client assignment limits |
| Edit task fields or status | Any accessible task | Any accessible task | Tasks they created or are assigned |
| Assign another member | Yes | Yes | No; may self-assign or unassign self on an editable task |
| Comment, mention, follow, or unfollow | Yes | Yes | Yes |
| Transfer a task between same-scope boards | Yes | Yes | No |
| Create or configure boards, workflows, defaults, labels, or detection | Yes | No | No |
| Change project/Channel task scope | Yes, with required Channel membership | No | No |
| Archive or restore a task, board, or suggestion | Yes | No | No |
| Run historical or imported-memory extraction | Yes, with required source access | No | No |

Clients create tasks as unassigned or assigned to themselves. Accepting a
suggestion as a client applies the same rule. Owners, admins, and staff can
triage those tasks to another eligible assignee. This preserves the selected
scoped-client collaboration policy while legacy Projects remain active.

### Company-model Project matrix

Company-model Projects use neutral `manager` and `member` Project roles. Company
owner/admin/member roles affect Company administration and add no task
capability. The task policy is:

| Action | Project manager | Project member |
| --- | --- | --- |
| View Project-scoped boards and tasks | With active or archive Project access | With active or archive Project access |
| View Channel boards, tasks, suggestions, and evidence | With matching active or archive Channel access | With matching active or archive Channel access |
| Create a task on an accessible active board | Yes | Yes |
| Accept an accessible task suggestion | Yes | Yes, subject to member assignment limits |
| Edit task fields or status | Any accessible active task | Active tasks they created or are assigned |
| Assign another Project member | Yes, when the assignee can access the task | No; may self-assign or unassign self on an editable task |
| Comment, mention, follow, or unfollow | With active access | With active access |
| Transfer a task between same-scope boards | Yes | No |
| Create or configure boards, workflows, defaults, labels, or detection | Yes | No |
| Change Project/Channel task scope | Yes, with required Channel membership | No |
| Archive or restore a task, board, or suggestion | Yes | No |
| Run historical or imported-memory extraction | Yes, with required source access | No |

Project members create tasks as unassigned or assigned to themselves. Project
managers triage work to any eligible Project member, including a member of
another participating Company. Assignment changes workflow ownership and grant
no Company, Project, or Channel membership authority.

Every company-model write records the authenticated user, their Project
membership, and Acting Company. A multi-Company user's capabilities come from
the selected Acting Company membership for that request; Track never unions the
user's memberships across Companies.

Read-only archive access permits viewing, searching, and opening retained
links within the exact Project/Channel boundary captured at Company exit. It
denies every mutation and produces no reminder, push, unread notification,
suggestion decision, or detection work.

Guided Company upgrade shows the resulting task capabilities before activation.
Legacy staff mapped to neutral members lose broad edit/transfer authority unless
appointed Project managers. Legacy clients retain scoped collaboration. Each
participating Company confirms its own member and manager mappings under the
Company specification.

Authorization is enforced by Convex for reads and writes. UI control visibility
communicates capability and never serves as the permission boundary. List
counts, search totals, board names, evidence counts, notification copy, and
error messages follow the same access policy as the underlying task.

## Notifications and due dates

Task notifications cover:

- assignment and unassignment;
- a mention in a task comment;
- a new comment on a followed task;
- an important field change on a followed task;
- due-soon and overdue reminders for the assignee;
- loss of assignment after a membership or scope change.

Self-authored actions produce no notification to the actor. Routine reordering
and automatic suggestion creation produce no push. Each Project membership has
a task push preference with `important`, `all_followed`, and `muted`. Assignment
and direct mentions remain visible in the in-app notification feed under every
push preference.

The assignee receives one due-soon reminder at 09:00 on the preceding calendar
day and one overdue reminder at 09:00 on the following calendar day. Scheduling
uses the assignee's saved profile timezone and UTC when no timezone is set.

Notification target collection rechecks task and evidence access immediately
before delivery. Push copy for a Channel task is sent only to current Channel
members. Scheduled due reminders are canceled or become no-ops after completion,
archive, due-date change, unassignment, or access removal. Deep links open the
task directly on web and mobile.

Opening a notification item marks that row read. **Mark all read** updates only
rows the selected Project membership can currently access. Membership or scope
loss redacts or removes the affected rows before the feed and unread count are
returned, so aggregate counts reveal no restricted activity.

## Search and filtering

Project search adds an accessible **Tasks** section. It searches task key,
title, and description and returns board, state, priority, assignee, and due
metadata. Pending suggestions remain discoverable through Inbox filters.

Task list and board filters include scope, board, Channel, workflow state or state
category, assignee, creator, priority, due state, label, and archived state.
Filters persist in the URL on web. **My tasks** applies assignee=selected Project
membership and open state categories across all accessible boards.

Read-only Company or Project archives provide a separate task list and search
over the exact task and Channel history authorized at exit/archive time. They
show no live Inbox, My tasks workload, detection controls, reminders, unread
feed, or mutation controls.

Search runs through permission-filtered server functions. Pagination continues
until it fills an authorized page or exhausts results, so hidden matches never
leak through totals, empty gaps, ordering, snippets, or timing-dependent UI.

## Web experience

The web release includes:

- Tasks navigation, Inbox, My tasks, All tasks, and board switcher;
- Kanban and dense list views;
- board creation, archive/restore, defaults, and workflow configuration for
  task administrators;
- drag-and-drop with keyboard-accessible Move controls;
- routable task drawer with fields, evidence, subtasks, comments, followers,
  and activity;
- Channel task panel and open-task count in conversation;
- Create task actions on messages and assistant answers;
- live inline task cards and linked-source navigation;
- task search and filters;
- task notification preferences and detection settings.

Board drag operations use optimistic presentation and reconcile to the server
result. A rejected or stale move returns the card to its authoritative location
and announces the error. Keyboard users can move a card through menus without
dragging.

Company-model views show a subordinate Company badge for creators, assignees,
comment authors, suggestion decision actors, and activity actors where Company
identity affects interpretation. The badge comes from immutable Project
membership attribution rather than the user's current Acting Company.

## Mobile essentials

Mobile adds a Tasks entry inside each project with My tasks, accessible boards,
All tasks, and Inbox. A board is presented as state-grouped lists with a status
picker instead of desktop drag-and-drop.

The first mobile release supports:

- viewing, filtering, and opening accessible tasks;
- creating a task and accepting or dismissing permitted suggestions;
- changing title, description, status, assignee, priority, due date, labels,
  and subtasks within the user's permissions;
- comments, mentions, follow state, evidence, and activity;
- Create task from a message's long-press actions;
- live inline task cards in conversation;
- push deep links to a task.

Board creation, workflow configuration, default-board selection, Channel
detection configuration, and historical extraction remain web administration
features in the first release. Mobile explains this boundary and links to no
dead or placeholder control.

## Loading, empty, error, and offline behavior

Every task surface has explicit loading, empty, permission-lost, error, and
retry states. Empty states distinguish no tasks, no filter matches, no
accessible boards, and no pending suggestions.

Message sending completes independently of task detection. A model outage or
detection failure never delays, rolls back, or duplicates a chat message.
Automatic detection retries bounded transient failures and records the last run
status for task administrators who belong to that Channel. Explicit requests surface a
concise retry action.

Task and suggestion writes validate access again at commit time. If membership,
board state, assignee eligibility, or workflow configuration changed while a
form was open, the server rejects the stale submission with a specific safe
error and the client refreshes valid choices.

Task detail edits use a revision value. A stale edit returns a conflict response
and shows the current server value before the user retries. Move/reorder
mutations are atomic and deterministic. Suggestion acceptance and comment send
use idempotency keys.

Web and mobile keep the last reactive data already rendered during a transient
disconnect where the client runtime supports it. The first release provides no
durable offline mutation queue. Unsaved task-form text remains local through a
retry, and a failed optimistic mutation leaves no phantom task, comment, or
state change.

The required recovery contract is:

| Trigger | Server result | Retained client state | User-visible recovery |
| --- | --- | --- | --- |
| Model/provider failure during automatic detection | Message stays committed; run becomes failed; checkpoint stays unchanged | Conversation stays current | No chat error; task-administrator Channel diagnostics show **Detection failed** and retry after bounded automatic attempts |
| Detection disabled or Channel removed while a run waits | Preflight aborts, or an in-flight result is discarded; checkpoint does not advance | No suggestion is added | Settings show disabled or unavailable; re-enable starts after the current high-water cursor |
| Network loss during task, suggestion, or comment submit | No confirmed response; idempotency key makes retry safe | Form/comment text and selected fields remain | **Couldn't save** with Retry; success reconciles to the one server object |
| Membership or scope loss before commit | Mutation returns `task_access_changed` and writes nothing | Sensitive cached view is removed on reactive refresh; unsent text remains local until exit | Generic **Task unavailable or access changed** with Back; no hidden names or ids |
| Stale task revision | Mutation returns `task_conflict` with the authorized current revision | User's draft remains separate | Conflict panel shows authorized changed fields and offers Review and reapply |
| Board archived or workflow state removed before commit | Mutation returns `task_destination_invalid` and writes nothing | Other form fields remain | Form refreshes eligible board/state choices and asks for a new destination |
| Concurrent suggestion decision | First terminal transition wins; later calls return that terminal result | Reviewer edits remain local and are never applied to a second task | Open created/linked task or show dismissed result; no blind retry |
| Rejected optimistic move | Authoritative rank/state stays unchanged | Card reconciles to the returned server position | Announced **Move couldn't be saved** with Retry when still authorized |
| Offline deep link with no cached authorized task | No server read occurs | Route and return destination remain | Offline unavailable state with Retry; unauthorized and nonexistent states stay indistinguishable after reconnect |
| Company-exit task snapshot fails | Participation remains `exit_pending`; writes and delivery stay blocked; partial snapshots remain unreadable | Exit progress and original cutoff remain | Authorized administrator retries at the same cutoff or safe-cancels, which removes partial snapshots before restoring access |

## Accessibility and visual behavior

Task UI follows [DESIGN.md](./DESIGN.md). Status, priority, overdue, blocked
access, and suggestion state use text or icons in addition to color. Workflow
colors use semantic tokens from the maintained light and dark palettes.

Descriptions, comments, labels, suggestion text, and model output are untrusted
content. Web and mobile render the supported Markdown subset through the shared
sanitization policy, disable raw HTML, and give external links safe behavior.

Web supports visible focus, logical tab order, semantic lists and dialogs,
keyboard task movement, and announcements for accepted suggestions, state
changes, conflicts, and errors. Mobile primary actions meet the 44px touch
target. Evidence and permission explanations remain available without hover.
Motion is brief and respects reduced-motion preferences.

## Persistence and source-of-truth rules

Convex is authoritative for task data, permissions, ordering, activity,
suggestions, comments, and notification state. Proposed schema additions are:

- `taskBoards`: Project, optional Channel scope, name, description, default flag,
  archive state, creator Project membership, Acting Company, and timestamps;
- `taskWorkflowStates`: project, board, name, semantic category, visual token,
  rank, default flag, and timestamps;
- `tasks`: public task key, Project, board, optional Channel scope, optional
  parent, workflow state, rank, title, description, assignee Project membership,
  priority, due date, creator Project membership and Acting Company, revision,
  terminal/archive state, source suggestion, and timestamps;
- `taskLabels` and `taskLabelLinks`: project label catalog and task association;
- `taskReferences`: task, source type and identifiers, source project/Channel,
  invalidatable bounded quote snapshot, availability state, primary flag, actor
  Project membership and Acting Company, rank, and timestamps;
- `taskComments`: task, immutable original visibility Channel, author Project
  membership and Acting Company, Markdown body, mentioned Project memberships,
  revision/archive state, idempotency key, and timestamps;
- `taskFollowers`: task, user, Project membership, reason, preference, and
  timestamps;
- `taskActivities`: task, immutable original visibility Channel, actor Project
  membership and Acting Company, action, safe before/after summary, correlation
  id, and timestamp;
- `taskSuggestions`: Project, scope kind, optional source Channel, proposed
  fields, status, confidence, grounding reason, fingerprint, possible duplicate,
  decision actor/reason, decision Project membership and Acting Company,
  accepted or linked task, duplicate override, archive state, model/prompt
  version, and timestamps;
- `taskSuggestionReferences` and `taskSuggestionHides`: scoped source references
  and per-Project-membership hidden state;
- `taskDetectionSettings` and `taskDetectionRuns`: per-Channel enabled state,
  generation, high-water cursor, expected cursor range, lease, coalescing/job
  status, bounded diagnostics, and timestamps;
- `taskNotificationSettings`: per-Project-membership preference;
- `taskNotifications`: recipient Project membership and user, task, immutable
  original visibility Channel, source event, event type, access-safe payload,
  read state, idempotency key, and timestamp;
- `taskReminderJobs`: task, recipient Project membership and user, reminder kind,
  due date, scheduled job reference, status, idempotency key, and timestamps;
- `taskArchiveSnapshots` and child snapshot rows when the Company model is
  enabled: participation term, archive Project membership, exit/archive
  timestamp, exact Channel entitlement, snapshot manifest, and bounded copies
  of every archive-visible mutable field. The copies cover boards, workflows,
  tasks, labels and links, comment body/revision/archive state, suggestion
  proposed fields/status/archive state, reference-link/cache state, membership
  labels, and actor Project-membership/Acting-Company display attribution.

Company and Acting Company attribution fields are present for company-model
Projects and remain optional only inside the documented legacy adapter. The
logical Channel reference can continue using the existing physical `groupId`
during migration; task storage creates no second scope identifier.

The existing `contentReports` validator and references expand to support task,
task comment, and task suggestion targets without copying restricted content
into report rows.

Indexes must support Project and Channel authorization, board/state/rank
queries, assignee/My tasks, parent/subtasks, task key, pending suggestions by
scope, fingerprint idempotency, followers, comments/activity pagination, due
reminders, and task search. Index and search design must avoid whole-table
filtering.

Shared enums and policy inputs live in `packages/shared` without framework
imports and match Convex validators. The schema and generated Convex API remain
aligned through their generator.

### Required invariants

Every server mutation enforces these invariants:

- referenced Project, board, Channel, workflow state, task, parent, label,
  assignee, suggestion, and evidence records belong to the same Project;
- a Channel task's board has the same Channel and a project task's board has no
  Channel;
- a task's workflow state belongs to its board;
- a subtask matches its parent's board and scope and has no child of its own;
- an assignee, follower, notification recipient, and mentioned Project
  membership belongs to the same Project and can access the task through that
  exact membership;
- every company-model actor Project membership belongs to the authenticated
  user and selected Acting Company, and immutable attribution survives later
  membership changes;
- task evidence, comments, activity, and notification rows retain their original
  source scope after task promotion and require both original and current
  access;
- an evidence snapshot is returned only while its live source exists and the
  viewer may access that source;
- a scope with active boards has exactly one active default, a scope with none
  has zero defaults, and each board has exactly one active default state;
- a suggestion and its accepted task use the same Project or Channel scope, and
  every suggestion reference is compatible with that scope;
- task suggestion status is exactly `pending`, `accepted`, `linked`, or
  `dismissed`, and every terminal transition starts from `pending`;
- a detection result commits only when its generation and starting cursor match
  the current setting, and checkpoint advancement shares that transaction;
- task-key uniqueness, suggestion acceptance, task moves, scope changes, and
  membership cleanup are transactional;
- read-only archive access rejects every task mutation and generates no live
  detection, reminder, notification, or unread state;
- archived boards and tasks reject normal writes;
- public functions resolve the authenticated Track user, Project membership,
  and Acting Company and never trust caller-supplied actor identities.

Central task-policy helpers implement these checks for queries, mutations,
search, notifications, AI context collection, and audit reads. Clients receive
view models containing only authorized source labels and evidence excerpts.

## Backend and package boundaries

`convex` owns schema, policy, queries, mutations, background detection,
notifications, activity, and audit effects. Model work runs in a Node action and
persists through validated internal mutations. Public functions authorize the
request before invoking internal work.

`packages/shared` owns framework-neutral task enums, state-category helpers,
due-date helpers, permission inputs/decisions, and field validation shared by
web and mobile.

`apps/web` owns task routes, board/list presentation, drag-and-drop, the task
drawer, Channel panel, inline chat cards, and web administration. New task routes
regenerate `routeTree.gen.ts` through TanStack Router tooling.

`apps/mobile` owns native task navigation, state-grouped board lists, task
details, message actions, inline cards, and push routing. It shares domain
contracts and calls the same authorized Convex functions.

Task mutations write user-facing activity and existing `auditEvents` in the
same transaction where both are required. Scheduled or Node actions pass a
correlation id through internal mutations so one logical operation remains
traceable.

## Audit, privacy, and observability

Audit events cover board/workflow creation and configuration, task creation and
archive/restore, assignment, terminal-state changes, board transfer, scope
change, suggestion accept/link/dismiss/archive/restore, detection setting
changes, historical scans, and administrative comment removal. Routine rank
changes can be summarized.

The existing content-report flow adds task, task comment, and task suggestion
targets. A viewer can report accessible content with the maintained reasons.
Report handling preserves task scope, and report notifications or audit views
never expose Channel content to a moderator who lacks that Channel under the
current Project access contract.

An eligible reviewer is an active task administrator who can access the exact
task and original content scope. When none exists, Track stores the report as
open, tells the reporter that review is awaiting an eligible Project reviewer,
and sends no content or restricted metadata outside the scope. A later eligible
administrator can review it after the same runtime access check.

Channel-scoped audit payloads remain hidden from project managers who lack that
Channel. Project-wide audit views may state that a restricted event occurred only
when the existing audit product explicitly supports a redacted count; the first
release can omit those events for unauthorized viewers.

Operational logs may contain ids, durations, status codes, token counts,
confidence bands, and error categories. They contain no raw messages,
descriptions, comments, evidence quotes, task titles, model prompts, or model
responses. Stored model diagnostics are bounded and access-controlled.

Automatic detection metrics include run success/failure, candidates generated,
suggestions accepted/dismissed, duplicate flags, acceptance latency, and fields
edited before acceptance. Product analytics use opaque ids and categorical
events. These metrics establish a pilot baseline before numeric quality targets
are set.

## Lifecycle and migration

Track has no current durable task table, so feature launch requires no legacy
task-record migration. Historical messages and imported memory remain source
material until a person explicitly requests extraction or creates a task.

Legacy or individual membership removal revokes task access immediately, clears
invalid assignments and follows, and preserves attributed history under the
Project's account retention rules. Company exit and Project archive revoke live
writes and notification delivery while preserving the exact authorized
read-only task history defined by the Company specification.

Company exit records an exit timestamp, the exact Channel set held by each
exiting Project membership, and bounded snapshots of mutable board, workflow,
task, label, comment, suggestion, reference-link, membership-label, and
author-Company fields. Immutable activity and evidence events are bounded by
the exit timestamp; comments and every other mutable child read only from their
exit snapshot.
Later edits and new work stay invisible. An authorized legal, security,
privacy, or retention redaction can still replace affected snapshot content
with a generic tombstone.

Exit preparation records one cutoff, enters `exit_pending`, and immediately
blocks live task writes, detection, reminders, and notification delivery. It
builds and verifies a complete task snapshot manifest before the Project
participation becomes `exited`. A missing or failed snapshot leaves the
participation in `exit_pending`; retry reuses the original cutoff. An authorized
safe-cancel discards partial or orphan snapshots before restoring active access.
Rejoining after a completed exit creates a new versioned participation term and
leaves the earlier archive separate.

Project archival approval transitions boards, tasks, suggestions, comments,
evidence, followers, detection, reminders, task notifications, and task writes
in one atomic lifecycle operation. Live participants retain the resulting
read-only Project history under the same Channel boundaries.

Channel removal requires a confirmation that names the number of boards, tasks,
suggestions, and evidence links affected; the removal workflow archives those
task objects and prevents orphaned references. Legacy Project deletion cascades
through all task tables under the existing destructive-action policy.
Company-model shared Projects use unanimous archive and retained-history rules
and have no unilateral hard-delete path.

Account deletion anonymizes or removes personal task preferences and follows
while retaining shared tasks, comments, activity attribution required for team
integrity, and audit history according to the maintained privacy contract.

## Acceptance criteria

The core task feature is ready to ship on its enabled policy profile when
statements 1–15 are observed in a local production build. A release that also
enables the Company model must additionally satisfy statements 16–18.

1. A task administrator can create multiple project and Channel boards,
   configure independent workflows, choose defaults, and archive/restore a
   board.
2. Every role fixture in the enabled legacy or company-model profile receives
   exactly the task controls in its permission matrix.
3. A task administrator outside a restricted Channel cannot discover its board,
   tasks, suggestions, evidence, counts, search matches, notifications, or ids.
4. Each role can perform its permitted task actions on web, including the full
   create, edit, assign, reorder, move, complete, reopen, comment, follow,
   archive, and restore set across the authorized fixtures.
5. Subtasks enforce one-level nesting and parent scope/board invariants.
6. Creating a task from a message or assistant answer attaches evidence and
   renders a live inline card whose status and assignee update reactively.
7. Routine task updates create no assistant-authored chat message.
8. Automatic detection runs after eligible chat activity, never blocks message
   send, creates only validated Channel-scoped suggestions, respects the
   per-Channel switch, and discards stale-generation results without advancing
   the cursor.
9. A reviewer can edit, accept, dismiss, hide, or resolve a possible duplicate
   for an authorized Project- or Channel-scoped suggestion; acceptance uses a
   same-scope board, and every concurrent decision returns one idempotent
   accepted, linked, or dismissed terminal result.
10. Channel-to-project promotion requires explicit declassification confirmation,
    moves the task and subtasks to a project board, and keeps references
    plus pre-promotion comments and activity restricted.
11. Removing or redacting a reference removes its quote, preview, search
    presence, and source-side card while retaining only an authorized generic
    tombstone.
12. Task search, My tasks, filters, unread counts, audit events, task activity,
    due reminders, and push deep links expose only authorized data.
13. Mobile can complete every workflow listed under Mobile essentials and opens
    task deep links from a terminated and foreground app.
14. Model, network, stale-edit, permission-loss, archived-board, and offline
    failures show the specified safe recovery state without phantom writes.
15. Keyboard-only web use can create, open, edit, move, and complete a task;
    screen-reader announcements cover important async outcomes.
16. A company-model task action records the authenticated user, exact Project
    membership, and Acting Company; My tasks, Inbox hides, follow state,
    notifications, unread counts, and archive reads never union another Company
    membership.
17. Company exit immediately stops task writes, detection, reminders, pushes,
    and unread changes in `exit_pending`, completes the task snapshot manifest
    before `exited`, and preserves only the exact authorized read-only
    Project/Channel history; retry reuses the cutoff, safe-cancel cleans partial
    snapshots, and later task, comment, suggestion, label, or reference-link
    changes remain invisible.
18. Guided upgrade preserves every legacy Group task scope and evidence boundary,
    shows staff/client capability changes, and activates neutral manager/member
    policy only after the Company-model approvals succeed.

When threads are also enabled, the combined integration criteria in
[THREADS_SPEC.md](./THREADS_SPEC.md) apply without becoming a dependency for a
task-only release.

## Testing and verification gate

Automated coverage must include:

- shared enum, state-category, due-date, and policy tests;
- Convex authorization matrix tests for all four legacy roles, both neutral
  Project roles, Acting Company selection, active/read-only access,
  project/Channel scope, membership loss, evidence redaction, and assignment
  eligibility;
- multi-Company same-user tests proving separate My tasks, Inbox hides, follow
  state, notification feed/unread count, deep-link context, and archive access;
- Company-exit snapshot tests covering `exit_pending`, blocked writes, retry at
  the original cutoff, safe-cancel cleanup, exact Channel entitlements, mutable
  task/comment/suggestion/label/evidence state, later live edits, authorized
  redaction tombstones, and rejoin as a new participation term;
- schema-invariant and transactional tests for task-key collisions, defaults,
  workflow migration, ranking, subtasks, scope changes, suggestion terminal
  transitions, idempotent comments, and archive behavior;
- AI structured-output validation, Project- and Channel-suggestion scope,
  confidence gating, source scoping, fingerprint deduplication, likely-duplicate
  handling, generation/lease races, cursor compare-and-set, retry, and
  provider-failure tests with a fake model adapter;
- evidence invalidation tests for deletion, redaction, expiration, revocation,
  promotion, and membership loss;
- search pagination and leak-resistance tests;
- notification targeting, due rescheduling, access recheck, and deep-link tests;
- web component and route tests for board/list states, drawer routing, forms,
  conflicts, drag rollback, keyboard movement, inline cards, Inbox, and filters;
- mobile tests for task navigation, status grouping, forms, message actions,
  inline cards, error surfaces, and push routing;
- conditional thread integration tests when both feature flags are enabled.

The implementation handoff runs and observes the repository gate:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

After the automated gate, load the affected web routes from a local production
build on `localhost` and exercise the acceptance flows with an owner, staff
member, client, and restricted nonmember while checking the browser console.
When the Company model is enabled, also exercise a Project manager, scoped
member, user acting for two Companies, restricted Channel nonmember, and exited
Company archive.
Load the affected mobile build or development client on iOS or Android and
exercise the mobile essentials, foreground/background push link, and denied
deep link. Production deployment requires separate explicit approval.

## Implementation phases

| Phase | Outcome | Depends on |
| --- | --- | --- |
| 0. Contracts and policy | Shared language, authenticated-actor prerequisite, validators, central legacy/company policy adapter inputs, schema, indexes, fake AI adapter, and test fixtures are settled. | Company phase 0 before company-model data is enabled |
| 1. Manual task core | Boards, workflows, tasks, subtasks, labels, comments, followers, activity, archive, and manual Convex APIs work end to end. | 0 |
| 2. Web planning surface | Tasks navigation, Inbox shell, board/list views, task drawer, configuration, filters, and accessible movement work against real data. | 1 |
| 3. Conversation connection | Message/assistant conversion, evidence navigation, Channel task panel, live inline cards, and explicit sharing work end to end. | 1, 2 |
| 4. AI suggestions | Detection settings, coalesced jobs, structured extraction, deduplication, suggestion inbox decisions, explicit requests, and bounded history/memory scans work with fake and configured providers. | 0, 1, 3 |
| 5. Cross-cutting product behavior | Search, task notifications, due scheduling, audit coverage, observability, lifecycle cleanup, and concurrency recovery are complete. | 1, 3, 4 |
| 6. Mobile essentials | Native task navigation, lists/details, Inbox, create/update/comment, message conversion, inline cards, and push routing work against the same backend. | 1, 3, 4, 5 |
| 7. Company-model reconciliation | Neutral roles, Acting Company attribution, Channel naming, exact guided migration, and read-only exit/archive behavior work through the central task policy. This phase is required only for a release that enables the Company model. | Task 0–6 and Company phases 3–6 |
| 8. Hardening and rollout | Full gate, accessibility pass, permission red-team, performance checks, local production walkthrough, docs transition, and controlled feature rollout are complete. | 2–6; also 7 when Company model is enabled |

Phases may overlap only where their write scopes do not conflict. Schema,
shared contracts, central permission helpers, generated Convex declarations,
route generation, and workspace navigation each have one active owner at a
time. Every phase ends with its targeted tests and an observed local workflow;
code completion alone does not advance the phase.

When Phase 8 ships, remove the task-management item from
[ROADMAP.md](./ROADMAP.md), reconcile the running behavior with
[PRODUCT.md](./PRODUCT.md), update [ARCHITECTURE.md](./ARCHITECTURE.md),
[DESIGN.md](./DESIGN.md), README, and release notes in the same change.
