# Mobile Push Notifications Specification

Status: product direction captured; design and implementation not approved.

## Intent

Track's mobile push notifications should feel as immediate and dependable as
WhatsApp. When authorized activity happens in a conversation, an eligible user
should expect a timely notification while the app is foregrounded, backgrounded,
or terminated.

“Aggressive” means Track attempts delivery for every eligible event instead of
quietly batching, digesting, or suppressing conversation activity. It does not
mean bypassing operating-system permission, user mute controls, access policy,
privacy settings, or platform delivery limits.

## Settled boundaries

- The direction applies to iOS and Android; web and desktop notification design
  remain outside this specification.
- Delivery must recheck current Project and Channel access and must not expose
  restricted content through notification copy, badges, counts, or deep links.
- Tapping an authorized notification should open the exact conversation context.
- Duplicate delivery and self-notification are product failures.
- Video conferencing notifications are outside the current implementation.

## Open decisions

The full specification still needs to define eligible events, thread and reply
behavior, foreground presentation, sounds and badges, grouping, mute controls,
quiet hours, privacy-safe previews, retry and deduplication behavior, measurable
delivery expectations, and platform-specific failure recovery.

## Definition of done

This document is intentionally not implementation-ready. It becomes a complete
specification only after the open decisions have observable acceptance criteria,
the backend and mobile source-of-truth boundaries are defined, and delivery is
verified on physical iOS and Android devices in foreground, background, and
terminated states. Production rollout requires separate explicit approval.
