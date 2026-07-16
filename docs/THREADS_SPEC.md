# Channel Threads Specification

Status: approved product direction; implementation pending.

This specification defines Discord-style threads inside Track Channels. Threads
are an independent release: task management can ship without them, and threads
can ship without task management. When both features are enabled, they use the
integration contract below.

The target philosophy and product model are in [PRODUCT.md](./PRODUCT.md). The
running product is summarized in [README.md](../README.md).

## Product intent

Threads let a team branch focused work from a busy Channel without creating a
new Channel or losing the surrounding Project context. A thread is easier to
follow than a reply chain, but it does not create another audience or security
boundary.

Track follows the Discord interaction model: a member can create a named thread
from an existing message or start one directly in a Channel. Thread messages
live in a focused stream, while the parent Channel remains the shared context
for search, assistant retrieval, and future task detection.

## Goals

- Add named focused conversations inside a Channel.
- Let a Channel member create a thread from a message or directly.
- Keep thread access identical to parent Channel access.
- Give threads independent follow and unread state without making all thread
  activity noisy for every Channel member.
- Let a thread creator or Channel steward manually archive and reopen a thread.
- Make thread messages searchable, referenceable, reportable, and available to
  permission-aware AI as part of the whole Channel context.
- Support the complete thread conversation workflow on web and mobile.
- Preserve exact Project membership and Acting Company attribution.
- Remain independently deployable from task management and enhanced mobile push
  delivery.

## First-release exclusions

The first release excludes private or restricted threads, nested threads,
automatic thread archival, direct messages, cross-Channel threads, moving a
thread between Channels, thread-specific files or memory scopes, anonymous or
guest participation, and relationship-wide threads.

Threads reuse existing Channel attachments, voice notes, mentions, reactions,
reports, assistant answers, retention, and message safety behavior. A thread is
not a board, task, record, AI review queue, or separate Channel kind.

## Canonical language

- **Thread**: a named focused conversation nested inside one Channel.
- **Source message**: the optional existing Channel message from which a thread
  was created.
- **Thread creator**: the exact Project membership that created the thread.
- **Thread follower**: a Project membership whose thread activity contributes
  to unread and notification behavior.
- **Active thread**: a writable thread shown in the Channel's active thread
  list.
- **Archived thread**: a read-only thread removed from the active list but still
  searchable and referenceable.
- **Channel steward**: a company-model Project manager who represents one
  Company in the Channel and can administer Channel lifecycle. During legacy
  compatibility, an owner or admin with exact Group membership supplies this
  capability.

Use “thread,” “follow,” “unfollow,” “archive,” and “reopen” in product copy.
Do not call a thread a room, topic, subchannel, or private conversation.

## Access and Company-model compatibility

A thread belongs to exactly one Project and one Channel. It has no membership
list. Every active member of the parent Channel can discover and read every
active or archived thread in that Channel. Every active Channel member may
create a thread and post in an active thread.

Company membership, Relationship participation, Company administration, and
Project management never substitute for Channel membership. A manager outside a
restricted Channel cannot discover its thread names, source messages, message
counts, followers, unread state, notifications, search matches, links, or ids.

Every thread and thread message stores the authenticated user, exact Project
membership, and Acting Company where the Company model is enabled. A person who
represents two Companies uses only the selected membership for reads, writes,
follow state, unread state, notifications, search, and archive access. Track
never unions those memberships.

Legacy Projects use their current roles and exact Group membership through the
central Project/Channel policy adapter. The physical `groups` and
`groupMembers` tables may continue backing the logical Channel during migration;
threads create no parallel Channel or membership system.

## Thread creation and conversation

A thread has a required name. An active Channel member may create it in either
of two ways:

- **From a message** links one existing message in the same Channel as the
  immutable source message.
- **Start a thread** creates a named thread directly in the Channel without a
  source message.

Creation is idempotent. Concurrent retries with the same idempotency key return
the same thread. A source message can start at most one thread, and concurrent
requests for that source converge on the one recorded result.

Thread messages render in their own routable stream and do not duplicate into
the main Channel timeline. A source message shows a thread link, latest-reply
state, and reply count to authorized viewers. Directly created threads appear in
the Channel's active thread list. The Channel header offers active and archived
thread views.

Thread messages support the same Markdown, replies, mentions, attachments,
voice notes, reactions, assistant invocation, reporting, forwarding, editing,
redaction, and deletion rules as Channel timeline messages. A reply inside a
thread remains in that thread. The first release does not create a nested thread
from a thread message.

Deleting or redacting a source message removes its preview and replaces the
source link with a generic unavailable tombstone when retention requires one.
The thread and its remaining messages persist because the source message is
context rather than ownership of the child conversation.

## Following, unread state, and notifications

Creating a thread, replying in it, or being mentioned follows the thread for the
selected Project membership. A Channel member may follow or unfollow any thread
explicitly. Following preferences and follower counts are private; the UI shows
only the current membership's state and never exposes a follower roster or
count.

Only followed-thread activity contributes to that membership's thread unread
state and ordinary thread notifications. A direct mention remains an important
notification even when the recipient does not follow the thread. Self-authored
actions produce no notification to the actor.

Each thread maintains a read cursor per selected Project membership. Opening a
thread advances only that authorized membership's cursor. **Mark Channel read**
may advance the main timeline and followed threads that the membership can
currently access; it never marks another Acting Company membership or a hidden
Channel read.

The Channel list indicates unread followed-thread activity without counting
messages from threads the membership does not follow. The thread list shows
which followed threads are unread. Losing Channel access removes thread unread
state and notifications from returned counts before the next reactive result.

Thread notification rows and push events reuse the maintained notification
policy and recheck Channel access immediately before delivery. The enhanced
reliability and foreground/background/terminated delivery contract is governed
separately by
[MOBILE_PUSH_NOTIFICATIONS_SPEC.md](./MOBILE_PUSH_NOTIFICATIONS_SPEC.md); the
thread release emits correct authorized events without depending on that
separate rollout.

## Archive and reopen

The thread creator or an authorized Channel steward may rename, archive, or
reopen a thread while they retain active Channel access. No other Channel member
may change thread lifecycle.

Archiving is a server-transactional transition from `active` to `archived`. It
makes the thread read-only, removes it from the active list, preserves its
messages and follow/read state, and records an audit event. Track does not
archive a thread automatically because of age or inactivity.

Reopening transitions `archived` to `active`, returns the thread to the active
list, preserves its route and history, and records an audit event. Archiving or
reopening a Channel or Project applies its broader lifecycle without rewriting
the thread's own state.

## AI and context

A thread organizes conversation but does not isolate knowledge from its parent
Channel. An assistant request from the Channel timeline or a thread may use
bounded relevant context from the whole Channel, including its timeline and
active or archived threads, plus other Project evidence the selected membership
is authorized to use. It never crosses into another Channel merely because the
person can access both.

Thread messages participate in the same server-authoritative Channel message
sequence used by assistant retrieval and, when task management is enabled,
automatic task detection. Provider calls, persisted answers, citations, logs,
and model diagnostics follow the existing permission and privacy contract.
Assistant output appears in the stream where it was requested and retains the
parent Channel scope.

## Task-management compatibility

Threads and tasks have no release dependency. The task release must work against
Channels with no thread records, and the thread release introduces no task
tables, routes, cards, suggestions, or task navigation.

When both features are enabled:

- a thread message or completed assistant answer exposes **Create task** under
  the same rules as a Channel timeline message;
- a task created from thread evidence is Channel-scoped to the parent Channel;
- inline task cards and linked-task indicators render in thread streams;
- automatic detection uses bounded whole-Channel context, including thread
  messages, under the Channel's one detection cursor and setting;
- **Find tasks in history** includes authorized thread messages in its bounded
  Channel range;
- deleting or redacting thread evidence invalidates task previews under the task
  evidence contract; and
- a task deep link may return to the exact source thread and message.

These combined behaviors are acceptance requirements only when both feature
flags are enabled. Neither standalone release waits for the other.

## Search, reporting, and deep links

Project search indexes authorized thread names and thread messages. Results show
the parent Channel and open the exact thread and message. Permission-filtered
pagination must not leak hidden thread names, counts, snippets, ids, or result
gaps.

A Channel member may report accessible thread messages through the existing
content-report flow. Reviewer eligibility requires current access to the exact
Channel. Report rows retain identifiers and reasons without copying restricted
message content.

Web and mobile routes use opaque thread identifiers. An unauthorized or missing
thread returns the same generic unavailable state. Losing Channel access removes
thread content, source previews, search results, unread counts, notifications,
and cached route metadata on the next reactive update.

## Web and mobile experience

Web includes thread creation from a message or directly, active and archived
thread lists, a routable focused stream, follow state, unread indicators,
rename/archive/reopen controls, search results, source navigation, and safe deep
links. Reload, browser history, and copied routes preserve the selected thread.

Mobile supports the same essential thread workflow: create, discover, open,
follow, reply, mention, attach existing supported media, archive or reopen when
permitted, search, and follow notification deep links. Thread actions use native
message menus and full-screen navigation. The first release exposes no dead
private-thread or auto-archive controls.

Both platforms preserve the current Channel conversation while a thread opens,
show explicit loading/empty/error/archived/access-lost states, meet maintained
touch and keyboard targets, announce async lifecycle outcomes, and avoid using
color as the only unread signal.

## Loading, failure, concurrency, and offline behavior

Message send and thread creation use idempotency keys. Access, Channel lifecycle,
thread revision, and creator/steward authority are revalidated at commit time.
A stale client never writes into an archived thread or reopens one after losing
its capability.

| Trigger | Server result | Retained client state | User-visible recovery |
| --- | --- | --- | --- |
| Network loss during create or reply | No confirmed response; idempotency key makes retry safe | Name or unsent message remains local | **Couldn't save** with Retry; success reconciles to one object |
| Thread archived while a reply submits | `thread_archived`; no message is written | Unsent reply remains local | Read-only thread with **Reopen** for creator/steward, otherwise Back |
| Channel access lost before commit | `thread_access_changed`; no write occurs | Protected cached data clears on reactive refresh | Generic **Thread unavailable or access changed** |
| Concurrent archive/reopen | First valid revision wins; stale mutation returns current authorized state | Current route remains | Refresh to active or archived state without blind retry |
| Source message deleted or redacted | Thread persists; source preview is invalidated | Thread messages remain | Generic unavailable-source tombstone |
| Offline deep link without cached authorized data | No server read occurs | Route and return destination remain | Offline unavailable state with Retry |

Web and mobile may retain already rendered authorized data during a transient
disconnect. The first release has no durable offline message or lifecycle queue.
Access loss removes protected cached views after reconnect.

## Persistence and source-of-truth rules

Convex is authoritative for thread records, messages, follow state, read state,
notifications, search authorization, lifecycle, and audit. Proposed additions
and changes are:

- `channelThreads`: Project, Channel, required name, optional source message,
  creator user, Project membership, Acting Company, active/archive state,
  revision, idempotency key, and timestamps;
- existing messages and assistant answers: optional thread identifier and one
  server-authoritative Channel sequence spanning timeline and thread messages;
- `channelThreadFollowers`: thread, user, Project membership, follow reason,
  explicit preference, and timestamps;
- `channelThreadReadState`: thread, user, Project membership, read cursor, and
  timestamps;
- existing notification, report, search, audit, and archive records: thread
  identifiers and immutable Project-membership/Acting-Company attribution where
  applicable; and
- Company-exit snapshots: bounded copies of mutable thread name/archive state,
  source-link state, and per-membership read/follow state needed by the exact
  exit entitlement.

Indexes support active/archived threads by Channel, source message, creator,
thread message pagination, the combined Channel sequence, followers, unread
cursors, notification targeting, and permission-filtered search without
whole-table filtering.

Every server mutation enforces these invariants:

- a thread, its source message, and every child message belong to the same
  Project and Channel;
- thread access is exactly parent Channel access and cannot be narrowed or
  broadened independently;
- only an active Channel member may create or post;
- only the creator or an authorized Channel steward may rename, archive, or
  reopen;
- an archived thread rejects messages until reopened;
- follow/read state belongs to one exact Project membership that can access the
  Channel;
- a source-message deletion never cascades into thread deletion;
- every company-model write records the authenticated user, Project membership,
  and Acting Company; and
- public functions derive actor identity and never trust caller-supplied user,
  membership, role, or Company values.

## Lifecycle and archives

Individual membership loss immediately revokes live thread access, removes
future notification delivery and returned unread state, and preserves authored
history. Channel archive makes all child threads read-only. Channel restore
returns only threads whose own state is `active` to writable behavior.

Company exit and Project archive capture the exact thread history available
through each authorized Channel at the lifecycle cutoff. Mutable names,
source-link state, archive state, and follow/read state use bounded snapshots;
later thread messages and edits remain invisible. Exit preparation blocks
thread writes and notification delivery before snapshot work begins.

Channel removal confirms the number of active and archived threads affected and
archives them with the Channel. Shared Projects and Channels have no unilateral
hard-delete path. Authorized legal, privacy, security, or retention redaction
may still replace source or message content with a generic tombstone.

## Acceptance criteria

The thread feature is ready to ship when all statements are observed in a local
production build:

1. A Channel member can create a named thread from a message or directly on web
   and mobile, and retries create only one thread.
2. Every active Channel member can discover and join the thread; a Project
   manager or Company admin outside the Channel cannot discover any metadata.
3. Thread messages remain in a focused stream, source messages show authorized
   thread state, and standalone threads appear in the active list.
4. Creating, replying, and mentions follow the thread; only followed activity
   contributes ordinary unread/notification state, while direct mentions still
   notify an unfollowed recipient.
5. The creator or Channel steward can rename, archive, and reopen; other members
   cannot, and archived threads reject new messages.
6. Search, reports, assistant answers, citations, attachments, voice notes,
   forwarding, deep links, and permission loss preserve the parent Channel
   boundary.
7. Assistant retrieval can use bounded whole-Channel context including threads
   without crossing into another Channel.
8. Web and mobile expose the complete maintained thread workflow with explicit
   loading, empty, archived, denied, conflict, offline, and retry states.
9. Company-model actions, follow state, unread counts, notifications, and archive
   reads remain separate for a user acting through two Company memberships.
10. Company exit and Project/Channel archive preserve only the exact authorized
    thread history and stop writes and delivery at the required lifecycle point.
11. With task management disabled, every thread workflow works without task
    tables, routes, cards, or suggestions.
12. With both features enabled, task creation, inline cards, detection, history
    scans, evidence invalidation, and return links work from thread messages.

## Testing and verification gate

Automated coverage includes:

- thread schema, source-message, lifecycle, idempotency, revision, and invariant
  tests;
- legacy and company-model authorization matrices, restricted Channel leaks,
  multi-Company Acting Company separation, membership loss, and archive access;
- follow/unfollow, automatic follow, unread cursor, mention, notification access
  recheck, and count-redaction tests;
- whole-Channel assistant context and cross-Channel exclusion tests;
- source deletion/redaction, search pagination, reporting, attachment, deep-link,
  and cache invalidation tests;
- web route and component tests for creation, lists, stream, focus, lifecycle,
  errors, and keyboard access;
- mobile navigation and component tests for creation, messages, follow state,
  lifecycle, push routing, offline state, and access loss; and
- conditional task integration tests when both feature flags are enabled.

The implementation handoff runs and observes the repository gate:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
pnpm build
```

After the automated gate, load a local production web build and exercise the
thread workflow with a Channel member, creator, steward, restricted nonmember,
and multi-Company user while checking the browser console. Exercise the same
essentials and foreground/background deep links on iOS or Android. Production
deployment requires separate explicit approval.

## Implementation phases

| Phase | Outcome | Depends on |
| --- | --- | --- |
| 0. Contract and policy | Shared language, central Project/Channel policy inputs, validators, schema, indexes, and fixtures are settled. | Company security prerequisite before company-model data is enabled |
| 1. Backend core | Thread creation, messages, follow/read state, archive/reopen, source invalidation, audit, and tests work through authorized Convex APIs. | 0 |
| 2. Web | Thread lists, routes, stream, creation, following, lifecycle, search, and error states work against real data. | 1 |
| 3. Cross-cutting behavior | Assistant context, notifications, reports, attachments, forwarding, Project/Channel lifecycle, and Company-exit snapshots are complete. | 1, 2 |
| 4. Mobile | Native thread navigation, creation, messages, follow state, lifecycle, and deep links work against the same backend. | 1, 3 |
| 5. Optional task integration | Create task, inline cards, detection, history scan, evidence invalidation, and source return work when task management is enabled. | Thread 1–4 and task conversation/AI phases |
| 6. Hardening and rollout | Full gate, accessibility, permission red-team, performance checks, local-production walkthroughs, docs transition, and controlled rollout are complete. | 2–4; also 5 only for a combined release |

When Phase 6 ships, remove the threads item from [ROADMAP.md](./ROADMAP.md),
reconcile running behavior with [PRODUCT.md](./PRODUCT.md), update
[ARCHITECTURE.md](./ARCHITECTURE.md), [DESIGN.md](./DESIGN.md), README, and
release notes in the same change.
