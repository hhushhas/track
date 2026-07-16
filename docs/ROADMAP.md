# Roadmap

This file tracks approved parts of the target contract in [PRODUCT.md](./PRODUCT.md)
that are not yet running behavior.

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
