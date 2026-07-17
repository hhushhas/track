# Roadmap

This file tracks approved parts of the target contract in [PRODUCT.md](./PRODUCT.md)
that are not yet deployed or enabled as running behavior.

## Companies, relationships, and shared projects

Company collaboration is implemented behind the independent, default-off
`TRACK_COMPANY_MODEL_ENABLED` server flag. Shared contracts, Convex, web, and
mobile include Companies, peer Relationships, shared Projects, explicit Channel
membership, neutral roles, immutable exit archives, and guided legacy migration.
The repository gate and lightweight local web verification pass; the capability
has not been deployed.

The approved product, access, lifecycle, migration, and implementation contract
is in [COMPANY_RELATIONSHIPS_SPEC.md](./COMPANY_RELATIONSHIPS_SPEC.md). Remaining
roadmap work is the required authenticated browser and native production-build
walkthrough, controlled migration and flag rollout, and production validation.
Company collaboration shares Project and Channel boundaries with the independent
task and thread releases without using either as an authorization prerequisite.

## Channel threads

Named Discord-style Channel threads are implemented behind the independent,
default-off `TRACK_THREADS_ENABLED` server flag. Shared contracts, Convex, web,
and mobile include direct and source-message creation, focused replies, follow
and unread state, lifecycle controls, search, assistant context, reports,
attachments, notifications, deep links, and exact Company attribution. The
repository gate and lightweight local web verification pass; the capability has
not been deployed.

The approved independent product and implementation contract is in
[THREADS_SPEC.md](./THREADS_SPEC.md). Remaining roadmap work is the required
authenticated browser and native production-build walkthrough, controlled flag
rollout, and production validation. Threads operate without task tables, routes,
cards, or suggestions when task management is disabled; when both releases are
enabled, thread messages and assistant answers can ground tasks and suggestions
without weakening the thread's Company and Channel access boundary.

## Task management and Kanban

Task management is implemented behind the independent, default-off
`TRACK_TASKS_ENABLED` server flag. Shared contracts, Convex, web, and mobile
include Project- and Channel-scoped boards, workflows, tasks, evidence,
conversation-derived work, human-reviewed AI suggestions, search,
notifications, due reminders, and essential native flows. The repository gate
and lightweight local web verification pass; the capability has not been
deployed.

The approved product and implementation contract is in
[TASK_MANAGEMENT_SPEC.md](./TASK_MANAGEMENT_SPEC.md). Remaining roadmap work is
the required authenticated browser and native production-build walkthrough,
controlled flag rollout, and production validation. Tasks operate without
thread records or Company collaboration when those independent features are
disabled, and retain their exact Project and Channel policy when combined.

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
