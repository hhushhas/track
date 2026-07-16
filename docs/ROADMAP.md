# Roadmap

This file tracks approved parts of the target contract in [PRODUCT.md](./PRODUCT.md)
that are not yet running behavior.

## Channel threads

Named Discord-style Channel threads are implemented behind the independent,
default-off `TRACK_THREADS_ENABLED` server flag. Shared contracts, Convex, web,
and mobile include direct and source-message creation, focused replies, follow
and unread state, lifecycle controls, search, assistant context, reports,
attachments, notifications, deep links, and exact Company attribution.

The approved independent product and implementation contract is in
[THREADS_SPEC.md](./THREADS_SPEC.md). Remaining roadmap work is the required
authenticated browser and native production-build walkthrough, controlled flag
rollout, and conditional task integration after task management exists. Threads
operate without task tables, routes, cards, or suggestions.

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
