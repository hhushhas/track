# Roadmap

This file tracks approved parts of the target contract in [PRODUCT.md](./PRODUCT.md)
that are not yet running behavior.

## Companies, relationships, and shared projects

Track will add first-class Companies that can form peer Relationships with two
or more Companies. Relationships authorize Companies to propose shared
Projects; they grant no Project or Channel access by themselves. Shared
Projects use neutral roles, explicit Company participation, explicit Channel
membership, non-destructive exit and archive rules, and a guided upgrade from
the current client/vendor Project model.

The approved product, access, lifecycle, migration, and implementation contract
is in
[COMPANY_RELATIONSHIPS_SPEC.md](./COMPANY_RELATIONSHIPS_SPEC.md).

The Company, thread, and task models share the same Project and Channel
boundaries. Their specifications must be reconciled before a combined release
so legacy roles and the current Group product noun do not survive into
company-model Projects.

## Channel threads

Track will add named Discord-style threads as focused sub-conversations inside a
Channel. A thread can start from a message or directly, inherits Channel access,
uses participation-based follow and unread state, and supports creator- or
steward-controlled manual archive and reopen.

The approved independent product and implementation contract is in
[THREADS_SPEC.md](./THREADS_SPEC.md). Threads can ship before or after task
management. When both features are enabled, thread messages support task
creation, inline task cards, whole-Channel detection context, and durable task
evidence without making either standalone release depend on the other.

## Task management and Kanban

Track will add first-class task management. The target experience combines
conversation-derived work with Kanban boards, explicit ownership, workflow
status, references, and Project/Channel visibility.

The approved product and implementation contract is in
[TASK_MANAGEMENT_SPEC.md](./TASK_MANAGEMENT_SPEC.md).

The replacement needs:

- a task domain model with boards, workflow states, assignee, priority, due date,
  and references;
- Project boards with Channel-aware visibility;
- explicit conversion from source messages or assistant output into tasks;
- task creation and management independent of AI;
- Project- or Channel-scoped imported memory with scope-preserving task evidence;
- permission rules for viewing, creating, assigning, moving, and closing tasks;
- notifications, audit events, search, and mobile behavior; and
- migration rules for task-like information that users choose to bring forward
  from conversation or imported memory.

Until this ships, Track remains a conversation, references, memory, and search
workspace without a durable work-item model.

## WhatsApp-style mobile push notifications

Track will make mobile conversation notifications feel immediate and dependable
while the app is foregrounded, backgrounded, or terminated. Delivery must
preserve Project, Channel, thread, and Acting Company access; deduplicate retries;
respect notification preferences; and open the exact authorized destination
without leaking unavailable content.

The product intent is in
[MOBILE_PUSH_NOTIFICATIONS_SPEC.md](./MOBILE_PUSH_NOTIFICATIONS_SPEC.md). That
specification still needs an implementation-ready contract for eligible events,
thread and reply behavior, foreground presentation, payload safety, delivery and
retry semantics, token lifecycle, deep links, observability, platform behavior,
and acceptance tests before implementation begins.

## Planning rule

Add an item here only when it represents agreed product direction.
Implementation detail belongs in an approved specification, issue, or pull
request. Remove roadmap text when the behavior ships, update
[ARCHITECTURE.md](./ARCHITECTURE.md), README, and release notes in the same
change, and reconcile [PRODUCT.md](./PRODUCT.md) if running behavior changed the
target contract.
