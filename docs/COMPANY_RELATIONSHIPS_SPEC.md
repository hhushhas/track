# Company Relationships and Shared Projects Specification

Status: approved product direction; implementation pending.

This specification defines Track's company, relationship, shared-project, and
channel model. The current shipped contract remains in
[PRODUCT.md](./PRODUCT.md) until this work passes its release gate. Where this
specification conflicts with the planned task model in
[TASK_MANAGEMENT_SPEC.md](./TASK_MANAGEMENT_SPEC.md), this specification is
authoritative for company identity, neutral roles, project participation,
channel naming, and access control. The two specifications must be reconciled
before either combined release ships.

## Product intent

Track should let companies establish a durable business relationship and then
choose the projects, people, channels, and future tasks they share. A
relationship makes collaboration possible. It never grants access to work by
itself.

The model must support a relationship with two or more peer companies. Any
participating company can invite another company. Shared projects remain the
operational work containers, so conversation, evidence, memory, search, audit,
notifications, and task management retain one dependable project boundary.

People may represent more than one company. Every company-scoped action records
which company the person was acting for, while the authenticated Track user
remains the human identity behind the action.

## Goals

- Make Company a durable first-class identity with members and neutral roles.
- Let two or more companies form a peer Relationship through explicit consent.
- Let a Relationship contain multiple independent shared Projects.
- Require each company to accept every Project it joins.
- Keep Project and Channel membership explicit and separate from company or
  relationship membership.
- Replace vendor-relative `staff` and `client` semantics with neutral company
  and project roles.
- Preserve Track's existing conversation, evidence, memory, assistant, search,
  notification, report, and audit boundaries during migration.
- Give every company an enduring read-only record of work already shared when
  it exits a Project.
- Provide a safe guided upgrade for current Projects without inferring company
  identity from legacy roles.
- Establish the project and channel contract that first-class task management
  will use later.

## First-release exclusions

The first release excludes public company directories, legal-entity
verification, verified-domain ownership, billing and subscription ownership,
CRM data, contracts, procurement workflows, relationship-wide chat,
relationship-wide files or memory, direct messaging, cross-project channels,
cross-project task boards, external federation, and automatic company creation
from email domains.

The first release has no unilateral hard-delete flow for shared Projects or
Channels. Archive, exit, and read-only retention cover normal product
lifecycle. A later retention policy may add time-bound purge or legal-hold
behavior without changing the access model defined here.

## Canonical language

- **Company**: a durable business identity in Track.
- **Company member**: a Track user who may act for a Company.
- **Acting Company**: the Company a multi-company user represents for one
  audited action or current navigation context.
- **Relationship**: a named peer network containing two or more Companies that
  have agreed they may start shared work.
- **Relationship participant**: a Company with an active membership in a
  Relationship.
- **Project**: an operational work container owned collectively by its active
  participating Companies.
- **Project participant**: a Company that accepted participation in one
  Project.
- **Project member**: a Company member explicitly admitted to one Project for
  that Company.
- **Channel**: a conversation and evidence scope inside one Project. Channel is
  the forward product name for the current Group concept.
- **Channel member**: a Project member explicitly allowed to read and
  contribute to one Channel.
- **General**: the default shared Channel in a new Project.
- **Read-only archive**: the immutable view of content a former Project
  participant was allowed to access before exit.

Use these nouns in product copy, routes, new contracts, tests, and maintained
documentation. Do not use `organization`, `workspace`, `account`, or `team` as
synonyms for Company. Do not use `connection` and `invitation` interchangeably:
a relationship is the accepted business network, while an invitation is a
pending request to join a Company, Relationship, Project, or Channel.

The physical Convex tables may retain `groups` and `groupMembers` during the
additive migration. That storage detail does not create a second product noun
or a second conversation primitive.

## Core invariants

The following rules apply to every platform and server function:

1. Company membership grants no Project or Channel access.
2. Relationship participation grants no Project or Channel access.
3. Project participation by a Company grants none of its people automatic
   access. Project membership remains explicit.
4. Project membership grants access to General because joining a new Project
   explicitly creates that Channel membership. It grants no access to any
   other Channel.
5. Company owners, company admins, and Project managers cannot read Channel
   content unless they are Channel members.
6. Every shared Project belongs to exactly one Relationship. A single-company
   Project belongs to one Company and has no Relationship.
7. Every Company invited to a Project is already an active participant in that
   Project's Relationship.
8. Every Project member represents exactly one participating Company for that
   membership. A user representing two Companies has two distinct memberships
   and an explicit Acting Company.
9. Reads and writes use one selected Project membership and never union access
   across a user's Companies. Switching the Acting Company switches the
   represented membership and its exact access.
10. Every message and audited write records both the authenticated user and the
   Acting Company. Historical company attribution does not change when a user
   later changes membership.
11. Shared history is archived or retained. One Company cannot erase content
    already shared with another Company.
12. Convex derives the authenticated user on the server. A caller-supplied
    `userId`, `actorId`, `authorId`, or Company role is never authoritative.
13. Search results, counts, notification copy, audit payloads, assistant
    context, evidence previews, filenames, and error messages obey the same
    access boundary as the source object.

## Information architecture

The primary navigation hierarchy is:

```text
Acting Company
├── Projects
│   └── Project
│       ├── Channels
│       ├── Tasks (when the task specification ships)
│       ├── Search
│       └── Settings
├── Relationships
│   └── Relationship
│       ├── Companies
│       ├── Shared Projects
│       └── Activity
├── Company members
└── Company settings
```

Changing the Acting Company updates company administration, relationships, and
the default Project list. A Project available through more than one of the
user's Company memberships appears once and shows the current represented
Company. Switching representation never changes the authenticated person.

Company owners and admins see Relationship participant identity,
relationship-level administrative activity, and shared Project metadata.
Ordinary Company members see only the Projects they have joined. Relationship
pages show no Channel names, message previews, task counts, files, Project
memory, or member rosters from a Project the viewer cannot access.

Project navigation remains the home for conversation and future task work. New
UI uses Channel. Legacy Projects can continue to show their existing Groups
until their guided upgrade finishes.

## Roles and authority

### Company roles

Company roles are `owner`, `admin`, and `member`.

- An owner has all Company administration rights and can transfer ownership or
  close the Company when lifecycle requirements are satisfied.
- An admin manages Company profile data, Company members, Relationship actions,
  and the Company's Project participation.
- A member may act for the Company in Projects where they have a separate
  Project membership.

A Company must always have at least one active owner. An owner cannot demote,
remove, or leave as the last active owner.

### Project roles

Project roles are `manager` and `member`.

- A manager administers Project metadata, creates Channels, manages the Project
  members who represent the same Company, and participates in archive approval.
- A member collaborates within their accessible Channels and future task
  scopes.

Each active Project participant must maintain at least one active Project
manager. A Company owner or admin appoints managers only from that Company's
active members. A Project manager can add, suspend, or remove only Project
members representing the same Company.

Project management authority and content access are independent. Creating a
Channel enrolls its creating manager. Further Channel administration requires
both Project-manager authority and Channel membership. A manager outside a
restricted Channel cannot discover its name, messages, attachments, tasks,
evidence, member activity, unread state, search matches, or existence through
counts.

### Capability matrix

| Action | Company owner/admin | Project manager | Company or Project member |
| --- | --- | --- | --- |
| Edit own Company profile | Yes | No separate authority | No |
| Invite or manage own Company members | Yes | No | No |
| Create a Relationship | Yes | No | No |
| Invite a Company to a Relationship | Yes, while acting for an active participant | No | No |
| Accept or decline a Relationship invitation | Yes, for invited Company | No | No |
| Propose a shared Project | Yes | No | No |
| Accept Project participation | Yes, for invited Company | No | No |
| Appoint own Company's Project managers | Yes | No | No |
| Manage own Company's Project members | Yes | Yes | No |
| Create a Channel | With Project-manager membership | Yes | No |
| Edit or administer a Channel | With Project-manager and Channel membership | With Channel membership | No |
| Read or contribute to Channel content | Only with Channel membership | Only with Channel membership | Only with Channel membership |
| Request Project archive | With Project-manager membership | Yes | No |
| Approve Project archive for own Company | Yes or an appointed Project manager | Yes, for represented Company | No |

All capabilities require an active authenticated user, an active membership in
the Acting Company, and the applicable verified Company, Project, and Channel
chain. Relationship participation is required for starting new shared work and
does not govern content in an already accepted Project.

## Company lifecycle and membership

### Company creation

Any authenticated user may create a Company and becomes its first owner. A
Company has a display name, unique normalized handle, optional logo, status,
creator, and timestamps. The handle supports exact private discovery. Track
does not claim that the Company is a verified legal entity.

Company names are not globally unique. The UI always shows the unique handle
and enough inviter context to distinguish similarly named Companies. Reserved,
misleading, and abusive handles follow a server-controlled validation policy.

### Company member invitations

Owners and admins invite a person by email or secure link and choose
`admin` or `member`. Invitations expire, can be revoked, and can be accepted
only by the authenticated intended recipient. Acceptance is idempotent.

Pending state lives only on the invitation. Company membership states are
`active`, `suspended`, and `removed`. Acceptance atomically consumes the
invitation and creates the active membership. Suspension immediately removes
the ability to act for the Company and revokes live Project and Channel access
derived from that Company membership. Authored content and immutable
attribution remain.

A user may have active memberships in multiple Companies. The client stores a
last-used Acting Company as navigation preference. Every write sends the
selected Company identifier as context, and the server verifies that context
against the authenticated user before authorizing the action.

### Company suspension

Every Acting Company, content, administration, archive, notification, and
background-job authorization requires the Company itself to be `active`.
Suspending a Company immediately pauses all of its members' live and archive
reads and writes, invitations, approvals, assistant and memory work,
notifications, scheduled delivery, and Project/Channel activity without
changing the underlying Relationship, Project, or membership terms. Other
Companies continue their authorized work.

A suspended Company's owner has one metadata-only recovery path to reactivate
the Company or complete required Project exits and closure. Suspension does not
count as consent to remove the Company or archive shared work, and it cannot be
used to bypass unanimous approval. Reactivation restores only access still
allowed by the unchanged underlying terms and creates no catch-up notifications.

### Company closure

A Company closes only after every single-company Project is archived, every
shared Project participation is exited, every approval request is resolved,
and the owner confirms the retention or export outcome for read-only archives.
Closing revokes Acting Company and archive access, suspends active memberships,
and prevents new invitations. Retained data follows policy but has no
self-service interactive view after closure. An owner who needs continued
read-only access keeps the Company active or suspended instead of closing it.
Closure does not delete another Company's shared history.

The first release provides no self-service hard purge of a closed Company.
Account deletion continues to anonymize personal profile fields while retaining
shared authorship and audit attribution required for Project integrity.

## Relationship behavior

### Creation and activation

A Company owner or admin creates a named Relationship while acting for their
Company. The new Relationship starts in `forming` state with the creator
Company active and at least one pending Company invitation.

The inviter selects an immutable target Company through its exact handle. Track
may deliver the addressed invitation to a known target admin by email or a
secure link, but the invitation never becomes an open claim link and cannot be
accepted for another Company. Track offers no browsable Company directory.
Before acceptance, the target sees the Relationship name, inviter, inviting
Company, and current participant Company identities. It sees no Projects,
people, Channels, content, or private Company profile fields.

An owner or admin of the exact invited Company accepts or declines. A
Relationship becomes `active` when at least two Companies are active. Declined,
revoked, expired, and accepted invitations remain in access-controlled
administrative history.

### Adding Companies

Any owner or admin acting for an active Relationship participant may invite
another Company. The target Company must accept. Existing participants receive
a safe administrative notification. They do not approve the addition because
Relationship membership exposes no Project content.

Duplicate pending invitations for the same Relationship and Company converge
on one record. Crossed or retried acceptance is idempotent. An accepted Company
never joins existing Projects automatically.

### Leaving and removal

A Company may leave a Relationship through one of its owners or admins.
Leaving blocks that Company from sending or accepting new Project and Company
invitations through that Relationship. Existing Projects remain active and
independent. Remaining active Companies retain their authority while the
Relationship remains active or is eligible for reactivation.

Forcing another Company out requires a removal proposal approved by every other
active Relationship participant. The target cannot approve its own removal and
receives notice of the proposal and result. Membership changes during voting
invalidate stale approvals and require the server to recompute the eligible
set.

Pending state lives only on the Relationship invitation. Relationship
participant states are `active`, `left`, and `removed`. When one Company
remains active, the Relationship becomes `inactive`. That remaining Company's
owner/admin may invite a new Company, which moves the Relationship to `forming`;
acceptance restores `active`. A Relationship with no active Company becomes
`closed`, which is terminal and requires a new Relationship for future work. A
Company that left or was removed has no invitation authority.

The leaving Company loses authority to propose or join new shared Projects
through the Relationship. Remaining active Companies may continue inviting
Companies or proposing Projects when the Relationship state permits. Its
administrative history and independent Projects remain. No Relationship action
silently changes Project, Channel, or task access.

## Shared Project behavior

### Project creation and Company acceptance

A Project has an immutable origin:

- **single-company**, created with one Company and no Relationship; or
- **shared**, created through exactly one Relationship.

Origin never changes when participant counts or Relationship state change. A
shared-origin Project may continue with one active Company after other
Companies exit and retains its Relationship provenance and shared-history
rules.

A Company owner or admin proposes a shared Project, selects one or more active
Companies from the Relationship, and supplies the Project name and optional
description. The proposal does not reveal content because the Project has no
shared content before activation.

Each invited Company's owner or admin accepts independently and appoints at
least one initial Project manager from their Company. The proposing Company
also appoints its initial manager. The Project becomes active when the proposer
and at least one invited Company are active. Other invitees may remain pending
and join later.

Pending state lives only on a Project Company invitation. Project participant
states are `active`, `exit_pending`, and `exited`. Acceptance atomically
consumes the invitation, creates a new versioned participation term, and
appoints the initial manager. A Project has no host Company with superior
content or deletion rights. The proposing Company is retained as provenance
only.

### Project members

When a Company accepts a Project, it chooses initial Project members and at
least one manager. Later, its Company owners/admins or its Project managers may
add more active members from the same Company.

Adding a person creates one Project membership for the represented Company and
one explicit membership in General. A user who represents two participating
Companies may be admitted once for each Company. The UI requires an Acting
Company choice before that user writes, manages, or comments in the Project.
All Project and Channel reads, unread state, notification state, typing state,
and last-active context use that selected Project membership. They do not merge
because the underlying authenticated human is the same.

Removing an individual Project member revokes live Project and Channel access,
clears invalid notification and future task-assignment state, and preserves
authored history. It does not grant that person a personal read-only archive.
Company-level Project exit controls the Company archive described below.

### General and additional Channels

Every new Project has one General Channel. Every active Project member is
explicitly enrolled into General when their Project membership is created. The
UI explains this default before a manager adds the person.

Additional Channels start with an explicit membership list. A Project manager
may create a Channel and add eligible members from their own Company. To add
people from another Company, the manager sends a Channel participation request
to that Company's Project managers, who select or approve their own people.
The creating manager becomes the first Channel member and steward.

Every Company represented in a Channel must maintain at least one Channel
steward who is both an active Project manager and an active Channel member for
that Company. Accepting a Channel participation request appoints a steward
before adding other members. A steward manages only their Company's Channel
members. Track blocks removal of the last eligible steward until a replacement
is appointed or that Company's Channel members are removed.

Channel membership is the only live content boundary. It governs messages,
replies, typing state, read state, attachments, voice notes, assistant answers,
Channel-scoped imported memory, search matches, reports, notifications,
evidence previews, and future Channel-scoped boards and tasks.

The current default `Internal` and `Commercials` kinds do not exist in new
company-model Projects. Their meaning is relative to one vendor and is
ambiguous in a peer relationship. Managers create explicitly named restricted
Channels instead.

Archiving a Channel makes it read-only and preserves its content. A Channel
archive request requires approval from one current steward representing every
Company with active Channel members. General cannot be archived while the
Project is active.

### Project archive

Any Project manager may request Project archive. The request lists the active
participating Companies and the content surfaces that will become read-only.
The Project archives only after a Project manager or Company owner/admin from
every active participant approves the current request.

Adding or exiting a Company invalidates stale archive approvals. Archive is
atomic, read-only, and reversible only through a new approval from every active
participant. Normal UI offers no hard delete.

### Company exit and read-only history

A Company owner or admin may exit one shared Project independently of its
Relationship membership. Starting exit immediately prevents new messages,
mutations, task changes, assistant runs, imports, notifications, and searches
against live Project state for that Company's Project members.

The exiting Company receives a read-only archive containing only the Project,
Channels, messages, attachments, evidence, future tasks, and audit details its
members could access at exit. Explicit Channel boundaries remain in force:
former members cannot discover Channels they never joined, and Company admins
do not gain historical content access merely because the Company exited.

Remaining Companies keep the shared history and continue the Project if at
least two remain active. With one active Company, the Project becomes a
single-participant continuation of the same shared record; it does not become a
new internal Project or rewrite attribution.

If the last active Company exits, the Project automatically becomes archived
with `no_active_participants` as its reason after every exit snapshot succeeds.
That archive is terminal for writes and cannot be restored; resuming work
requires a new shared Project. Former Company archive entitlements remain
readable under their Company-membership rules. A single-company Project has no
participant exit; its Company owner/admin archives it before Company closure.

Starting exit moves the participation to `exit_pending` and immediately blocks
new writes, notifications, assistant work, and memory mutation by the exiting
Company. The archive freezes at the prepared exit cutoff. It includes messages,
assistant answers, attachments, comments, activity, evidence, and audit events
created before that cutoff that each former member could access. It stores
exit-time snapshots for mutable Project, Channel, board, task,
membership-label, and author-Company fields. Post-exit content and edits are
invisible through the exited Company's membership. Files remain retrievable
through archive-checked URLs unless a separately authorized security, legal, or
retention action quarantines them.

Exit never creates an unaudited mutable copy. Convex owns archive entitlements,
the exit timestamp, and bounded snapshots for fields whose live value may
change. Immutable source records remain canonical for content that cannot
change after exit.

Each active Project membership for the exiting Company transitions to an
archive membership with the exact Channel set it held at exit. Archive access
continues only while that user remains an active member of the exited Company.
Company suspension or removal revokes the person's archive entitlement. No new
person can be granted archive access and no archived Channel set can be
broadened after exit.

Restoring or archiving the live Project later does not change the exited
Company's frozen view. A Company that rejoins starts a new versioned Project
participation term and new live memberships; its prior archive remains a
separate immutable historical entitlement.

Project exit also captures the exact Project `context.md` bytes available at
the cutoff. The memory gateway serializes context writes, copies that version
to an immutable Company-exit archive path, and records its source revision,
content hash, length, and snapshot identifier in Convex. Later Project-memory
updates are invisible to the exited Company. Channel scratch material gains no
new browse surface; retained source messages, attachments, and imports follow
their existing Channel archive boundary.

Exit is a retryable two-phase workflow because Convex and Upstash Box do not
share a transaction. The prepare step blocks the exiting Company's writes and
captures the cutoff. Finalization requires the verified immutable memory
snapshot and atomically creates archive entitlements, changes memberships, and
marks the Company term `exited`. A failed snapshot leaves `exit_pending`,
exposes a retry or safe cancel, and never reports the Company as exited.

## Conversation, evidence, AI, and memory

Messages remain Project- and Channel-scoped. A message stores the human author,
their Project membership, and immutable Acting Company attribution. Mentions
are limited to active members of that Channel.

Forwarding copies information into a new audience. Cross-Channel forwarding
requires source and destination membership, names the destination Companies,
shows a disclosure confirmation when the audience expands, and records an
audit event. A forwarded snapshot cannot imply that a destination viewer may
open the restricted source.

`@track` receives only content the requesting Project and Channel membership
can access. Relationship membership never broadens retrieval. Company owners,
Company admins, and Project managers receive no hidden Channel context.
Scheduled and Node actions recheck access before model work and again before
persisting or delivering output.

Project memory remains Project-scoped. Only facts safe for every active Project
member may enter shared `context.md`. Restricted Channel material may inform an
authorized run but cannot be promoted into Project-wide memory unless an
explicit declassification flow confirms the expanded audience. A read-only
archive exposes only memory that was available to the former viewer at exit.

Evidence keeps the access scope of its source. Moving a future task or answer
to a broader scope never broadens its evidence. Unauthorized viewers receive a
generic restricted indicator without hidden Company, Channel, filename, quote,
count, or identifier details.

## Task-management integration contract

The companion [task-management specification](./TASK_MANAGEMENT_SPEC.md) keeps
its core work model with these required reconciliations:

- Replace the product noun Group with Channel. The initial physical
  `groupId` may remain during migration, but no parallel scope is created.
- A board remains either Project-scoped or bound to exactly one Channel.
- Project-scoped task access means active Project membership for one active
  Project participant Company. Relationship or Company membership is
  insufficient.
- Channel-scoped task access additionally requires active Channel membership.
- Replace `owner`, `admin`, `staff`, and `client` task permissions with neutral
  Project `manager` and `member` rules. Company roles do not bypass task or
  Channel access.
- A task assignee must have an active Project membership. A Channel task
  assignee must also have active membership in that Channel.
- Task creator, comment author, suggestion decision, activity, assignment, and
  audit records preserve the actor's Project membership and Acting Company.
- Each Company manages only its own Project memberships. Task assignment may
  cross Companies when both people can access the task.
- Project managers may configure Project-scoped boards. Configuring or reading
  a Channel board also requires Channel membership.
- Company exit changes accessible tasks to the same read-only archive mode as
  conversation. Remaining participants retain the shared task history.
- Project archival approval covers boards, tasks, suggestions, comments,
  evidence, reminders, and task notifications in the same atomic lifecycle.

The merged neutral task capability matrix is:

| Task action | Project manager | Project member |
| --- | --- | --- |
| View Project task surfaces | With active Project membership | With active Project membership |
| View Channel boards, tasks, suggestions, and evidence | With active Channel membership | With active Channel membership |
| Create a task or accept an accessible suggestion | Yes | Yes; may assign only to self |
| Edit accessible task fields or status | Any active accessible task | Active tasks they created or are assigned |
| Assign another eligible Project or Channel member | Yes | No; may self-assign or unassign self on an editable task |
| Comment, mention, follow, or unfollow | With active access | With active access |
| Reorder or transfer between same-scope boards | Yes | No |
| Create or configure Project boards, workflows, defaults, or Project labels | Yes | No |
| Create or configure a Channel board or Channel detection policy | With active Channel membership | No |
| Promote or narrow task scope | With membership in every affected Channel and explicit disclosure confirmation | No |
| Archive or restore a task, board, or suggestion | With access to its scope | No |
| Run historical or imported-memory extraction | With access to the source scope | No |
| Hard-delete shared task history | No | No |

Members have scoped collaboration: they can create work and edit work they
created or are assigned. Managers own cross-member assignment, triage,
configuration, scope changes, transfer, and archive actions. Company
owner/admin status alone grants none of these task capabilities. Every task
write still records the represented Company and revalidates access at commit.

The task specification's AI authority, task suggestion, evidence, board,
workflow, notification, search, web, mobile, and failure-handling decisions
remain unchanged unless they conflict with an invariant above. The merged
implementation must use one centralized authorization policy rather than
layering Company checks around the legacy role matrix.

## Authorization and privacy requirements

### Authenticated actor prerequisite

The current backend commonly accepts caller-supplied user and actor identifiers.
That pattern is unsafe for a multi-company system. Before Company data becomes
available, every public Convex function must resolve the Track user from the
authenticated session and either remove actor identity arguments or prove they
match the authenticated user.

Central policy helpers must validate the complete chain required by an action:

```text
authenticated user
  -> active Acting Company membership
  -> active or archive Project participation
  -> active or archive Project membership
  -> active or archive Channel membership when content is Channel-scoped
```

Active Relationship participation is an additional prerequisite only for
inviting a Company, proposing a new shared Project, or accepting new Project
participation. Once a Company accepts a Project, ordinary Project and content
authorization depends on the Project participation term and memberships. A
later Relationship exit or inactive Relationship cannot revoke or broaden an
existing Project.

Company owners/admins also have a metadata-only administrative path:

```text
authenticated user
  -> active owner/admin membership in the Acting Company
  -> addressed invitation or active Project Company participation
  -> permitted Company-side administration
```

This path authorizes accepting participation, appointing the Company's
managers, managing its Project memberships, exiting the Company from a Project,
and casting its archive approval. It returns only safe Company, invitation,
participant, role, status, and approval metadata. It never returns Channel,
message, attachment, task, evidence, memory, search, unread, or notification
content. Project-manager administration continues through an active Project
membership. Invitation acceptance uses the immutable addressed invitation
before a Project Company participation term exists.

Clients may hide unavailable controls for clarity. Clients never decide access.
Internal functions accept trusted actor context created by an authorized public
entry point and preserve a correlation identifier.

### Administrative and content audit

Company, Relationship, Project-participation, and approval events are
administrative metadata. Channel messages, attachments, task details, evidence,
and AI payloads are content. An administrative role may inspect safe lifecycle
events without gaining content access.

Audit storage records Company, Relationship, Project, Channel, actor user, and
Acting Company scopes where applicable. Audit reads filter or redact payloads
before returning them. Hidden Channel names, message previews, filenames,
quotes, member activity, and task details never appear in Company-wide or
Relationship-wide audit views.

### Discovery and directory privacy

Private discovery exposes only the minimum identity needed to address an exact
Company and understand an invitation. A recipient cannot inspect a Company's
roster, domains, Projects, Relationships, activity, or private profile fields
before authorization.

Project member lists return access-safe profile views rather than full user
documents. Invitation email addresses are visible only to administrators of the
Company that sent or received the invitation. Relationship participants do not
receive each other's full Company directory.

### Runtime access rechecks

Search pagination, attachment URL generation, report submission and review,
assistant retrieval, memory reads, notifications, scheduled jobs, typing state,
unread counts, deep links, and push delivery recheck current access at execution
time. Cached client state disappears on the next reactive update after access
loss. Safe unavailable responses do not confirm whether a hidden object exists.

Content reports retain their source scope. Handling a report never grants a
Company administrator or Project manager access to restricted content. Eligible
reviewers are current Channel stewards who already have access to the reported
source; the reported author cannot review the report about their own content.
The report row stores target identifiers and reason without copying the message,
attachment, task, or evidence body.

When no eligible steward exists, the report remains sealed with `unassigned`
status and tells the reporter that no internal reviewer is currently eligible.
Track support receives no source content automatically. Any later legal or
safety escalation requires a separately authorized, audited access path outside
this release. Report retention follows the source Project and archive policy,
and reviewer access is rechecked before every read or decision.

## Persistence and source-of-truth rules

Convex is authoritative for Companies, memberships, Relationships, Projects,
Channels, invitations, approvals, access state, messages, audit, and archive
authorization. Upstash Box remains authoritative only for the Project memory
files described in [ARCHITECTURE.md](./ARCHITECTURE.md).

Proposed schema additions and changes are:

- `companies`: display name, normalized unique handle, logo,
  active/suspended/closed status, revision, creator, and timestamps;
- `companyMembers`: Company, user, role, active/suspended/removed status,
  inviter, immutable attribution fields, and timestamps, unique by Company and
  user;
- `companyInvitations`: Company, intended email or recipient, role, hashed
  token, status, expiry, inviter, and timestamps;
- `relationships`: name, lifecycle status, creating user and Company, revision,
  and timestamps;
- `relationshipCompanies`: versioned participation terms with Relationship,
  Company, active/left/removed status, acceptance or exit actors, and
  timestamps; at most one term is active per Relationship and Company;
- `relationshipInvitations`: Relationship, target Company, inviting Company and
  user, hashed token, status, expiry, and timestamps;
- `relationshipRemovalRequests` and approvals: Relationship, target Company,
  eligible participant revision, proposer, status, votes, and timestamps;
- `projects`: optional Relationship for shared Projects, proposing Company,
  immutable single-company/shared origin, lifecycle status, participant
  revision, and existing metadata;
- `projectCompanyInvitations`: Project, immutable target Company, inviting
  Company and user, status, expiry, and timestamps;
- `projectCompanies`: versioned participation terms with Project, Company,
  active/exit_pending/exited status, acceptance actor, archive/exit state,
  prepared cutoff, and timestamps; at most one term is live per Project and
  Company;
- `projectArchiveRequests` and approvals: Project, participant revision,
  requester, status, votes, and timestamps;
- `projectArchiveEntitlements` and exit snapshots: exited Company and Project,
  former Project membership, exit timestamp, authorized Channel set, frozen
  mutable metadata, immutable Project-memory snapshot identifier/revision/hash,
  retention status, and timestamps;
- `projectMembers`: versioned membership terms with Project, Project Company
  term, Company, user, neutral role, active/suspended/removed/archived status,
  immutable attribution fields, and timestamps; at most one term is live per
  Project, Company, and user;
- existing `groups` and `groupMembers`: the transitional physical storage for
  Channels and Channel memberships, extended with lifecycle, stewardship, and
  Project-member references while preserving existing identifiers; Channel
  membership is unique by Channel and Project membership, never Channel and
  user alone;
- `channelParticipationRequests`: Channel, target Project Company, inviter,
  status, selected members, decision actor, and timestamps;
- messages, assistant streams, future task activity, and audit events: immutable
  author Project membership and Acting Company attribution;
- read state, typing state, notification settings, active contexts, reports,
  attachments, search filters, memory jobs, and future task tables: keyed by the
  selected Project membership where representation matters and updated to
  follow active or archive Project and Channel policy.

Invitation tokens are random, single-use, stored as hashes, compared in
constant time where applicable, and expire. Acceptance, voting, member addition,
Project activation, archive, and exit mutations use idempotency keys or unique
records so retries cannot duplicate state.

Pending invitations never create Company member, Relationship participant, or
Project participant rows. Acceptance consumes the invitation and creates or
reactivates the corresponding versioned row in one transaction. Terminal
invitation history cannot authorize access.

Referenced Company and Project membership rows are tombstoned rather than
deleted. Their Company identifier, represented role at action time, and bounded
display snapshots remain immutable for messages, tasks, evidence, and audit.
Account deletion may anonymize the human profile while preserving referential
integrity and historical Company attribution.

Indexes must support Company membership and handle lookup, Relationship and
Project participation, pending invitations, unanimous-approval eligibility,
Project membership by Company and user, Channel membership, archive reads, and
permission-filtered search without whole-table filtering.

Shared enums and pure policy inputs live in `packages/shared` without framework
imports and match Convex validators. Generated Convex declarations are updated
through the generator after schema changes.

### Required data invariants

Every server mutation enforces these data rules:

- the Acting Company membership belongs to the authenticated user and is
  active;
- the Acting Company itself is active for every normal content,
  administration, archive, notification, and background action; suspended
  Companies have only the owner recovery path;
- a shared Project's Relationship is active when a Company is invited;
- a target Company is an active Relationship participant both when its Project
  invitation is issued and when it accepts; later Relationship exit does not
  invalidate the accepted Project Company term;
- every Project member belongs to the represented active Company;
- every Channel member references an eligible Project membership from the same
  Project;
- Channel membership, read state, notification state, typing state, and active
  context use the selected Project membership rather than a bare user id when a
  person may represent more than one Company;
- every scoped record's Company, Relationship, Project, Channel, membership,
  and source identifiers agree;
- a Project cannot activate without the required accepted Companies and one
  manager per active Company;
- General contains every active Project member in a new company-model Project;
- administrative authority never substitutes for Channel membership;
- relationship removal and Project archive approvals match the current
  participant revision and eligible Company set;
- exit and archive transitions are atomic and revoke live writes before
  exposing read-only state;
- a Project Company exit cannot finalize until every authorized mutable field
  and the exact Project-memory version have a verified immutable snapshot;
- attribution fields needed for shared history cannot be rewritten by later
  membership changes;
- referenced Company, Project, and Channel membership records are retained as
  tombstones and never hard-deleted;
- public functions never trust caller-supplied actor identity.

### Authoritative lifecycle transitions

Every transition is server-transactional. Repeating a completed transition
with the same idempotency key returns the existing result. A successful
transition increments the affected aggregate revision, writes audit, and runs
the dependent access cleanup before returning.

| Aggregate | Allowed transition | Authorized actor | Required effect |
| --- | --- | --- | --- |
| Company | create → `active`; `active` ↔ `suspended`; `active`/`suspended` → `closed` | Creator for create; owner for later transitions | Suspension pauses every Company-side authorization without mutating child terms. Enforce last-owner and closure prerequisites; `closed` is terminal. |
| Company invitation | `pending` → `accepted`/`declined`/`revoked`/`expired` | Intended user accepts/declines; Company owner/admin revokes; server expires | Accepted creates or reactivates one Company membership term; terminal states grant no access. |
| Company member | `active` ↔ `suspended`; `active`/`suspended` → `removed`; `removed` → `active` through a new accepted invitation | Company owner/admin, subject to last-owner protection | Revoke Acting Company, live Project, Channel, notification, and archive access before suspension/removal returns. |
| Relationship | create → `forming`; `forming` → `active`; `active` → `inactive`; `inactive` → `forming`; any nonclosed state → `closed` when no active participant remains | Participant changes drive state; eligible active Company owner/admin may invite from `inactive` | `active` requires at least two active Companies; `closed` is terminal. |
| Relationship invitation | `pending` → `accepted`/`declined`/`revoked`/`expired` | Target Company owner/admin accepts/declines; inviter revokes; server expires | Accepted creates a new active participation term and recomputes Relationship state. |
| Relationship Company term | create → `active`; `active` → `left`/`removed` | Own Company owner/admin leaves; every other active Company approves removal | Increment participant-set revision, invalidate stale votes, and preserve independent Projects. Rejoin creates a new term. |
| Project | create → `proposed` or `active`; `proposed` → `active`; `active` → `archive_pending` → `archived`; `archive_pending` → `active`; `archived` → `active` only while an active Company remains | Company acceptance activates; manager requests/cancels; every active Project Company approves archive/restore | Preserve immutable origin. Archive/restore is atomic across Channels and future task surfaces. Last-participant exit archives with a terminal reason. |
| Project Company term | create → `active`; `active` → `exit_pending` → `exited`; `exit_pending` → `active` on safe cancel | Target Company owner/admin accepts invitation, starts exit, retries, or cancels | Prepare revokes target writes and captures the cutoff; finalization requires verified snapshots, increments participant revision, and invalidates stale approvals. Rejoin creates a new term. |
| Project member term | create → `active`; `active` ↔ `suspended`; `active`/`suspended` → `removed`; `active` → `archived` on Company exit | Own Company owner/admin or Project manager; Company exit is aggregate-driven | Revoke writes, assignments, follows, notifications, and live Channel membership. Retain tombstone and attribution. Suspended members receive no archive entitlement. |
| Channel | create → `active`; `active` → `archive_pending` → `archived`; `archive_pending` → `active`; `archived` → `active` | Project manager creates; stewards request/cancel; every represented Company steward approves archive/restore | Creator becomes member/steward. General rejects archive while Project is active. |
| Channel membership | create → `active`; `active` → `removed`; `active` → `archived` on Company exit | Own Company steward; Company exit is aggregate-driven | Membership is keyed to one Project membership term. Rejoin creates a new membership. |
| Archive entitlement | create → `active`; `active` → `revoked` | Created by Company exit; Company membership suspension/removal or authorized retention action revokes | Never broadens after creation and never reveals post-exit state. Revocation is terminal. |

Approval requests use `pending`, `approved`, `cancelled`, `stale`, and `expired`.
Any eligible-participant revision change moves an unresolved request to `stale`.
Invitation and approval terminal states are immutable.

## Loading, failure, concurrency, and offline behavior

Every Company, Relationship, Project, member, invitation, approval, and Channel
surface has explicit loading, empty, permission-lost, expired, conflict, error,
and retry states. Errors identify the failed action without revealing hidden
objects.

Invitation acceptance rechecks recipient identity, inviter and target Company
status, Relationship status, expiry, existing participation, and current actor
authority in one transaction. Concurrent duplicate invitations converge.

Approval flows capture a participant-set revision. If a Company joins, exits,
or loses eligibility while an archive or removal request is open, the server
marks the request stale and requires a fresh decision. A stale client never
completes a destructive transition.

Membership and access are revalidated at commit time. If the Acting Company,
Project membership, Channel membership, or represented Company changed while a
form was open, the server rejects the write and the client refreshes current
choices. Optimistic UI rolls back without leaving a phantom participant,
message, or approval.

Web and mobile may retain the last authorized reactive data already rendered
during a transient disconnect. The first release has no durable offline queue
for invitations, membership changes, approvals, Project exits, or Channel
writes. Unsaved form text may survive a retry locally. Access lost while
offline removes cached protected views when the client reconnects.

## Web and mobile experience

The web release includes Company creation and switching, Company profile and
member administration, Relationship creation and invitations, Relationship
participant management, shared Project proposals and acceptance, guided legacy
Project upgrade, Project-member administration, Channel creation and
participation requests, unanimous approval flows, exit, and archive views.

Mobile includes Acting Company switching, Company-aware Project lists,
Relationship and Project invitation acceptance or decline, participant Company
identity, Channel navigation and chat, read-only Project archives, and safe deep
links. Company profile editing, member administration, Relationship removal
votes, legacy upgrade, and Project archive administration may remain web-only
in the first release. Mobile explains that boundary and exposes no dead
controls.

Company badges appear where identity affects interpretation: Project member
lists, message author metadata, mentions with ambiguous names, approvals, audit
events, and future task assignment. Badges remain visually subordinate to the
person and message. UI never relies on color alone to distinguish Companies.

Every invitation and audience-expanding action states which Companies and
people will gain access. Restricted states avoid displaying hidden Channel or
content counts. Destructive and exit actions explain retained history and
read-only outcomes before confirmation.

All new surfaces follow [DESIGN.md](./DESIGN.md): keyboard access and visible
focus on web, semantic controls, 44px mobile targets, WCAG AA contrast, announced
async outcomes, reduced-motion support, and permission explanations available
without hover.

## Migration from the current Project model

Migration is additive and owner-led. Track never infers Companies from
`owner`, `admin`, `staff`, `client`, `clientLabel`, email domain, or existing
Channel membership.

### Compatibility period

Current Projects remain usable as legacy Projects while Company tables and
neutral policy are introduced. New required Company references start optional
only for the compatibility period. Reads use one documented legacy adapter.
New company-model Projects always write the complete new shape.

No implementation may scatter ad hoc `companyId ?? legacy` branches across
features. Central project-scope and authorization adapters own the dual-read
period and emit diagnostics for remaining legacy records.

### Guided upgrade

An existing Project owner performs these steps:

1. Create or select the Company they represent.
2. Review every current Project member and explicitly map each person to a
   Company.
3. Invite counterpart Companies that do not yet participate in the selected
   Relationship.
4. Wait for each counterpart Company owner/admin to confirm Company identity,
   Relationship participation, and Project participation.
5. Review proposed neutral Project roles. Legacy owners/admins may be proposed
   as managers and staff/clients as members, but the upgrader and each
   counterpart Company confirm their own people.
6. Preserve every current Group membership exactly. General, Internal,
   Commercials, and custom Groups become Channels with the same names and
   members; no one gains access during upgrade.
7. Activate the new model atomically after every mapped Company has accepted
   and every active Company has at least one manager.

Before activation, the owner can cancel the draft upgrade without changing
live access. Activation is idempotent and records a complete safe audit summary.
Projects with uncertain mappings remain legacy until resolved.

### Migration completion

After every Project is upgraded or explicitly retired, remove the legacy role
adapter, required-field optionality, default Internal/Commercials provisioning,
and legacy invitation path. Regenerate Convex declarations, update task policy,
and use Channel consistently in current documentation and UI.

The migration must run against representative copied development data before
any production authorization is requested. This specification does not grant
production access or deployment approval.

## Acceptance criteria

The company model is ready to ship only when all of these statements are
observed in local production builds:

1. A user can create a Company, invite members, switch between multiple active
   Companies, and produce correctly attributed audited actions.
2. Company owners/admins and ordinary members receive exactly their permitted
   Company controls on web and mobile.
3. Any active Relationship Company can invite another Company through private
   discovery, and only an authorized target owner/admin can accept.
4. Joining a Relationship exposes no Project, Channel, member, message, task,
   evidence, memory, search, notification, or audit content.
5. A shared Project activates only after Company acceptance and one appointed
   manager per active participant.
6. Joining a Project creates General membership and grants no other Channel
   membership.
7. Company admins and Project managers outside a restricted Channel cannot
   discover its protected metadata or content through direct queries, search,
   counts, audit, notifications, AI, memory, reports, attachment URLs, or deep
   links.
8. A Project manager can manage only people representing their own Company.
9. A multi-company user can participate for either Company without one
   Company's membership or attribution leaking into the other.
10. Relationship leave blocks new work while existing Projects continue
    unchanged.
11. Forced Relationship removal and Project archive complete only with the
    required current Company approvals; stale and concurrent votes cannot win.
12. Project exit revokes live writes and notifications immediately and leaves
    only the former viewer's authorized read-only history.
13. New Projects provision General only. Guided upgrades preserve every legacy
    Group membership without role-based Company inference.
14. Message, attachment, evidence, assistant, memory, search, audit, report,
    notification, typing, read-state, and mobile flows enforce the new central
    policy end to end.
15. The reconciled task model uses Project/Channel scope, neutral roles, Acting
    Company attribution, and the same exit/archive rules.
16. Account deletion, Company suspension, last-owner protection, expired
    invitations, provider failures, stale forms, offline reconnect, and denied
    deep links produce the specified safe state without orphaned or phantom
    writes.
17. A Company owner/admin with no Project membership can perform only the safe
    Project-participation administration in this spec and cannot discover
    content.
18. Suspending a Company pauses all of its live and archive access without
    changing another Company's work; reactivation restores only still-valid
    access and produces no catch-up delivery.
19. Last-participant Project exit creates a terminal archive, and every exit
    archive exposes the exact frozen Project-memory version rather than later
    `context.md` changes.

## Testing and verification gate

Automated coverage must include:

- shared enum, status-transition, role, participant-revision, and policy tests;
- Convex authorization matrices across Company, Relationship, Project,
  Channel, live, and read-only archive scopes;
- authenticated-actor spoof tests for every public function migrated from
  caller-supplied identities;
- invariant and transaction tests for unique memberships, invitation races,
  Project activation, General enrollment, last-owner/manager protection,
  unanimous approvals, stale votes, Company suspension, metadata-only
  administration, zero-participant exit, archive, and idempotency;
- permission-leak tests for search pagination, counts, audit payloads,
  notifications, attachment URLs, reports, assistant context, memory, evidence,
  typing, read state, and deep links;
- legacy upgrade fixtures covering one Company, multiple Companies, ambiguous
  mappings, canceled upgrades, concurrent acceptance, exact Group membership
  preservation, and retry after partial failure;
- web tests for Company switching, private discovery, invitations, Project
  proposals, member administration, Channel participation, approvals, guided
  upgrade, exit, archive, errors, and keyboard access;
- mobile tests for Company switching, invitations, Project/Channel navigation,
  identity badges, read-only archives, access loss, and deep links;
- task integration tests once the companion specification is merged.
- exit-saga tests covering Box snapshot failure, verified retry, safe cancel,
  immutable memory version/hash, cutoff filtering, and orphan snapshot cleanup.

The implementation handoff runs and observes the repository gate:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

After the automated gate, load the affected web routes from a local production
build on `localhost`. Exercise the acceptance flows with at least three
Companies, one user representing two Companies, a Company admin outside a
restricted Channel, an active Project member, and an exited Company archive.
Check the browser console for errors.

Load the affected mobile build or development client on iOS or Android. Verify
Company switching, invitation acceptance, Project and Channel access, a denied
deep link, reconnect after access loss, and read-only archive behavior.
Production deployment requires separate explicit approval.

## Implementation phases

| Phase | Outcome | Depends on |
| --- | --- | --- |
| 0. Security prerequisite | Public functions resolve the authenticated actor, centralized scope helpers cover existing Project/Group features, and spoof/leak regression tests pass. | — |
| 1. Company foundation | Company records, multi-Company user memberships, roles, invitations, Acting Company context, profile UI, and audit work end to end. | 0 |
| 2. Relationships | Private discovery, multi-Company Relationship creation, invitations, activity, leave, forced-removal approvals, notifications, and concurrency rules work end to end. | 1 |
| 3. Shared Projects | Project Company proposals/acceptance, neutral roles, Company-specific member management, General provisioning, lifecycle state machines, administrative/content policy split, and navigation work end to end. | 1, 2 |
| 4. Channel policy | Channel naming, explicit membership, cross-Company participation, restricted administration, forwarding disclosure, archive approval, and conversation flows work end to end. | 3 |
| 5. Cross-cutting authorization | Search, audit, AI, memory, immutable exit snapshots/finalization, attachments, notifications, reports, read/typing state, Company suspension, account deletion, and mobile APIs use the central policy with leak tests. | 3, 4 |
| 6. Guided migration | Legacy mapping, counterpart confirmation, role review, exact Group preservation, diagnostics, cancellation, and idempotent activation work on representative data. | 3–5 |
| 7. Task reconciliation | The task specification uses neutral roles, Channel scope, Company attribution, Company-specific membership management, and shared exit/archive policy. | 3–6 and task phases 0–1 |
| 8. Hardening and rollout | Full gate, permission red-team, accessibility pass, performance checks, web/mobile local-production walkthroughs, docs transition, and controlled feature rollout are complete. | 1–7 |

Schema, shared contracts, central authorization helpers, generated Convex
declarations, route generation, workspace navigation, and migration adapters
each have one active owner at a time. A phase ends only after its targeted tests
and an observed local workflow pass.

## Implementation guardrails

- Do not create a parallel shared-channel message system beside current Groups
  and messages.
- Do not grant access through Company or Relationship membership.
- Do not let any administrative role bypass Channel membership.
- Do not keep `staff` or `client` as company-model roles.
- Do not infer Company identity from legacy roles, labels, email domains, or
  Group membership.
- Do not let one Company manage another Company's people.
- Do not let one Company hard-delete shared history.
- Do not expose restricted Channel names, counts, snippets, filenames, member
  activity, task metadata, or identifiers through administrative surfaces.
- Do not duplicate authorization logic across web, mobile, search, assistant,
  memory, tasks, notifications, and reports.
- Do not trust actor identifiers supplied by a client.
- Do not describe this planned behavior as shipped before Phase 8 passes.

When Phase 8 ships, fold the running behavior into
[PRODUCT.md](./PRODUCT.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and
[DESIGN.md](./DESIGN.md), update README and release notes, reconcile or retire
the companion planning specifications, and remove the delivered roadmap item in
the same change.
