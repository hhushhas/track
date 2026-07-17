# Mobile Push Notifications Specification

Status: ready for implementation approval; implementation has not started.

Companion: [visual planning deck](./MOBILE_PUSH_NOTIFICATIONS_SPEC.html)

## Background

### Problem

Track combines conversation and task work, but its mobile push path is not yet a
dependable extension of those surfaces. A person who leaves the app cannot rely
on seeing every eligible event once, opening its exact context, or knowing how
notification permission and account changes affect delivery.

The target is WhatsApp-like immediacy within Track's stricter Project, Channel,
thread, task, and Acting Company boundaries. “Aggressive” means Track attempts
delivery for every eligible event instead of silently batching, digesting, or
suppressing activity. It does not mean bypassing operating-system permission,
user mute controls, access policy, privacy settings, or platform delivery
limits.

### Current state

The repository already contains a partial native push path:

- an authenticated iOS or Android client requests notification permission,
  obtains an Expo push token, and registers it in Convex;
- message and task mutations schedule delivery through the Expo Push Service;
- the backend excludes self-authored messages, applies existing global,
  Channel, thread-follow, and task preferences, and rechecks active access while
  selecting recipients;
- foreground notifications use the platform banner and default sound; and
- a notification tap can route to a conversation, thread, or task, with tests
  covering several membership-aware routes.

That path is a prototype rather than a releasable delivery system:

- signing out does not detach the installation token from the previous account,
  so an account switch can leave the old account eligible to notify the device;
- permission is requested immediately with no explanatory screen, visible
  status, denial recovery, or settings shortcut;
- Channel-timeline notification routes omit the exact message target;
- delivery has no durable outbox, attempt record, retry policy, Expo receipt
  reconciliation, delivery metric, or operator-visible failure state;
- token rotation, application reinstall, multi-account ownership, and stale
  token cleanup are not modeled as installation lifecycle events;
- transient failures are swallowed, while only a narrow set of permanent errors
  disable a subscription;
- notification copy always includes message or task content and has no user
  preview control;
- the foreground handler cannot distinguish the conversation already on screen
  from activity elsewhere; and
- current tests do not prove physical-device delivery in foreground,
  background, and terminated states on both platforms.

### Desired state

For every eligible event, Track creates one authorized delivery intent per
recipient membership, resolves the active installations belonging to that
account, attempts each intended delivery through a measured and retryable path,
and reconciles the provider result. The user sees one privacy-appropriate alert
per intended device, and tapping it opens the exact authorized message, thread,
or task.

Permission denial, token rotation, sign-out, account switching, access loss,
provider throttling, duplicate scheduling, offline app state, and stale deep
links all have explicit outcomes. None can leak restricted content or leave a
device silently attached to the wrong account.

## Product intent and terms

- **Eligible event**: an event that passes the approved event matrix, current
  access policy, notification preferences, self-notification rules, and any
  foreground suppression rule.
- **Installation**: one installed copy of Track on one iOS or Android device.
  It owns the platform, Expo token, app environment, permission state last seen
  by Track, and current signed-in account association.
- **Delivery intent**: the durable server record that one eligible event should
  be attempted for one recipient membership and installation.
- **Provider acceptance**: confirmation that the push provider accepted a
  request. It does not prove that the operating system displayed the alert.
- **Exact context**: the message, thread, or task identified by the event plus
  the Project membership and Acting Company needed to authorize it.

Convex is authoritative for eligibility, access, preferences, unread state,
delivery intents, attempt history, and installation ownership. The operating
system is authoritative for notification permission and final presentation.
The Expo Push Service is a transport, not a source of truth.

## Settled boundaries

- The release applies to iOS and Android. Web and desktop notification design
  are outside this specification.
- Delivery rechecks current Project and Channel access and never exposes
  restricted content through copy, badges, counts, grouping labels, or links.
- Tapping an authorized notification opens the exact conversation context.
- Duplicate delivery and self-notification are product failures.
- Company-model notification state belongs to the selected Project membership;
  one human's memberships are never merged.
- Thread notifications inherit the parent Channel boundary. A thread has no
  independent audience.
- Video-conferencing notifications, marketing pushes, broadcast campaigns, and
  silent background data sync are outside this release.
- Production rollout and production credential changes require separate,
  explicit approval.

## Proposed first-release behavior

The first release uses the settled product posture from this planning session:
all eligible activity is on by default, permission is contextual and
foreground presentation is context-aware, and the transport is the Expo Push
Service.

### Eligible events

| Source | Eligible events | Recipient rule |
| --- | --- | --- |
| Channel timeline | Every new message or attachment | Active Channel members whose effective Channel preference allows it; never the author |
| Channel thread | New replies in a followed thread | Active Channel members following that thread; never the author |
| Important conversation activity | A direct mention or direct reply | The exact mentioned membership or author of the replied-to message, even when ordinary activity is set to mentions-only; an explicit mute still wins |
| Tasks | Assignment, assignment loss, mention, due soon, and overdue | The exact active Project membership affected by the event |
| Followed tasks | New comments and meaningful task changes | Followers whose task preference includes all followed activity |

Edits, deletes, read receipts, typing, reactions, routine task rank changes,
assistant streaming tokens, imports, and administrative audit events do not
create mobile pushes in the first release.

### Preference precedence

Eligibility is evaluated in this order so a narrower or safer rule always wins:

1. Current Project, Channel, thread, task, Company, and membership access.
2. Active installation ownership and operating-system permission as last
   observed by the app.
3. Explicit user mute for the relevant Channel, thread, or task category.
4. Global conversation and task notification modes.
5. Channel override, thread follow state, and task follow state.
6. Event importance, including direct mention, direct reply, assignment, and
   deadline events.
7. Foreground presentation rule for the exact context already on screen.

Operating-system Focus modes remain available. The first release does not add a
second Track-specific quiet-hours scheduler unless Hasan chooses otherwise.

### Permission and settings experience

Track explains the value of notifications before triggering the one-time iOS
permission prompt. The trigger is the first moment the user can
understand the benefit: after entering a Project with eligible activity, with a
persistent Notifications entry in account settings available before and after
that prompt.

The Notifications screen should show:

- system permission state with **Enable notifications** or **Open device
  settings** when Track cannot prompt again;
- conversation default: all messages, mentions and replies, or off;
- task default: important, all followed activity, or off;
- notification context: show safe sender and work-location metadata or hide it;
- sound and badge choices supported consistently by the two platforms; and
- a diagnostic **Send test notification** action for a development build.

Existing per-Channel overrides and per-thread follow controls remain close to
their conversation context and link back to the global screen.

### Presentation and copy

The default is a standard platform sound and a context-only preview. It gives
the recipient enough information to decide whether to open Track without
sending conversation or task content through Expo. Approved shapes include:

- **Bilal mentioned you in #launch-readiness**;
- **New reply from Aisha in #android**; and
- **You were assigned T-184 in Mobile release**.

The payload may contain the sender display name, safe event kind, Channel or
thread name, task public key, and Project name when needed to disambiguate the
recipient's active work. It never contains a message body, task title or
description, comment body, filename, attachment text, quoted evidence,
assistant output, or imported memory.

These context fields are still Project metadata that Expo processes during
handoff; they are a deliberate minimization boundary rather than an opaque
payload. Track's privacy documentation names Expo's role. Users can disable
notification context, in which case the alert identifies only Track and a safe
event kind without sender, Company, Project, Channel, thread, task, message, or
file metadata.

When Track is foregrounded on a different surface, the notification appears as
a normal banner. When the exact message or task is already visible, Track
suppresses the redundant system banner and lets the live interface render the
event. Badge values come from server-authoritative, currently authorized unread
state rather than from incremental push arithmetic.

Notifications may group visually by the exact Project membership and Channel or
task, but grouping never collapses multiple eligible events into one delivery.

### Notification tap

The payload contains a versioned, internal route hint and opaque identifiers.
It is untrusted input. On every cold, warm, or foreground tap, the app validates
the payload shape, restores the encoded Project membership and Acting Company,
asks Convex to authorize the target, and then opens the exact message, thread,
or task. If access changed, Track opens a safe unavailable state that does not
confirm hidden content.

The application remembers which notification response it consumed so a cold
start, authentication transition, or root-layout remount cannot navigate twice.

## Delivery architecture

### Transport choice and limits

The first release hardens the existing Expo Push Service integration. Expo
supports the interactive alerts, custom routing data, sounds, badges, foreground
handlers, provider tickets, and provider receipts needed by this specification.
Direct Apple Push Notification service and Firebase Cloud Messaging clients are
not required for these outcomes.

Expo is an at-least-once, best-effort handoff to Apple and Google. It has no
service-level agreement, may rarely duplicate or lose a handoff, and cannot
prove that the operating system displayed the alert. Direct provider clients do
not remove the final operating-system delivery limitation. Track therefore owns
idempotency, retries, receipt reconciliation, duplicate-open suppression, and
physical-device release proof rather than claiming exactly-once or guaranteed
display. See the current [Expo sending and reliability guide](https://docs.expo.dev/push-notifications/sending-notifications/)
and [Expo delivery FAQ](https://docs.expo.dev/push-notifications/faq/).

The sender obeys Expo's documented limits of 100 messages per request, 1,000
receipt ids per receipt request, and 600 notifications per second per Project.
It checks receipts after approximately 15 minutes and before Expo clears them
after 24 hours. Requests use Expo's optional access-token security so possession
of a leaked push token is insufficient to impersonate Track.

Expo holds notification payloads in memory and queues only long enough to hand
them to Apple or Google, but Expo staff may see them during active service
debugging. Track therefore sends only the approved context metadata above and
names Expo's role in its privacy documentation. An enterprise requirement that
forbids Expo from processing even sender or work-location metadata would require
fully opaque alerts or reopen the direct-provider decision.

### Source-of-truth records

The implementation should replace token-only subscriptions with an explicit
installation lifecycle and add durable delivery state:

- `pushInstallations`: installation id, owning user, optional current Project
  membership context only when needed for routing, platform, environment,
  Expo token, enabled state, last permission state, app version, last seen time,
  failure reason, and timestamps;
- `pushDeliveryIntents`: source event kind and id, recipient user and exact
  Project membership, installation, idempotency key, privacy-safe routing data,
  status, next attempt time, expiry time, and timestamps; and
- `pushDeliveryAttempts`: intent, attempt number, provider ticket id, sanitized
  result category, provider timing, and timestamps.

Message and task records remain the source for deriving context-only copy.
Delivery records persist the final privacy-safe title and body needed for retry
consistency, but never message bodies, task titles or descriptions, filenames,
quoted evidence, or other source content.

### Lifecycle

1. The event mutation writes its domain change and idempotent notification
   intent trigger.
2. A background job resolves recipients and rechecks current access,
   preferences, self-notification, and installation ownership.
3. One delivery intent is created per exact recipient membership and active
   installation. The idempotency key prevents duplicate scheduling.
4. The sender submits a bounded batch to the approved transport and records the
   provider ticket or classified failure.
5. Transient failures retry with bounded backoff before the intent expires.
   Permanent token failures disable that installation token.
6. Receipt reconciliation updates the terminal state and records metrics. It
   never treats provider acceptance as proof that the user saw the alert.
7. Opening the notification records an authorized open without storing
   notification content in analytics.

Sign-out disables the installation/account association before local
credentials are cleared. Signing into another account atomically claims the
installation for the new account and makes the previous association ineligible.
Token refresh updates the same installation instead of creating another
delivery target.

### Access and privacy

Access is checked when recipients are resolved and again immediately before
provider submission. A provider notification already accepted before later
revocation cannot be recalled, so hidden-preview mode and operating-system lock
screen controls remain the last privacy boundary after send. Every tap performs
a fresh server authorization.

Logs, metrics, attempt rows, and error reports may contain internal ids,
platform, environment, timing, and classified failure codes. They do not contain
message bodies, task titles, filenames, person names, Company names, Channel
names, Expo tokens, or raw provider payloads.

## Failure and offline behavior

| Condition | Required outcome |
| --- | --- |
| Permission not determined | Show the Track explanation and allow the user to trigger the system prompt |
| Permission denied | Do not loop the system prompt; show disabled state and a device-settings shortcut |
| Token unavailable or refresh fails | Keep the app usable, show a recoverable status, and retry registration on a later foreground/network transition |
| Sign-out or account switch | Detach the installation from the old account before the local session disappears |
| Duplicate event scheduling | Converge on one delivery intent per recipient membership and installation |
| Transient provider or network error | Retry within the event lifetime with bounded backoff and observable attempt state |
| Permanent invalid-token response | Disable the token, retain the installation record, and request a fresh token on a later app session |
| Access or preference changes before send | Cancel the intent without disclosing the previous target |
| Access changes after send but before tap | Open a safe unavailable state after fresh authorization |
| App offline when tapped | Preserve the pending route, show a connection state, and authorize before showing content after reconnect |
| Foreground exact context | Apply the approved foreground rule without producing a duplicate visible alert |

## Measurement

The first-release service objective is: during normal provider availability,
95% of eligible intents reach an accepted Expo ticket within five seconds and
99% within thirty seconds; every ticket reaches a receipt or classified expiry
state within twenty minutes. This target measures Track's controllable path and
Expo's handoff, not operating-system display. At minimum, Track records:

- eligible events, canceled events by safe reason, and created delivery intents;
- enqueue-to-provider-attempt and provider-response latency percentiles;
- provider tickets accepted, transient failures, permanent failures, retries,
  expirations, and invalid-token rate by platform and app version;
- authorized opens and duplicate-open suppression; and
- installation permission and registration state without storing notification
  content.

Provider acceptance and receipts do not prove operating-system display. The
physical-device release matrix remains the end-to-end proof.

## Implementation plan

### Phase 0 — settle the contract and verify provider assumptions

- [x] Settle default intensity, permission/privacy/foreground posture, and Expo
  transport scope.
- [x] Confirm Expo transport capabilities and limits against current official
  documentation.
- [x] Approve the delivery service objective and context-only Expo payload
  boundary.
- [ ] Audit the Apple, Firebase, Expo access-token, config-plugin, Project id,
  and non-production EAS credential path without changing production.
- [ ] Freeze the event matrix, preference precedence, payload version, and
  privacy copy after the non-production configuration audit.

### Phase 1 — installation ownership and durable delivery

- [ ] Add installation, delivery-intent, and attempt contracts with indexes,
  expiry, idempotency, and migration from current subscriptions.
- [ ] Make register, refresh, sign-out, account switch, reinstall, and permanent
  token failure explicit lifecycle transitions.
- [ ] Create delivery intents from message and task events without duplicating
  domain content.

### Phase 2 — reliable provider pipeline

- [ ] Submit bounded Expo batches, classify ticket failures, reconcile receipts,
  retry transient failures, disable invalid tokens, and expose sanitized
  diagnostics.
- [ ] Recheck access and preferences immediately before submission.
- [ ] Add metrics and a development-only test notification path.

### Phase 3 — mobile permission, settings, presentation, and routing

- [ ] Add the approved permission education and denial-recovery flow.
- [ ] Add the global Notifications screen and preserve Channel, thread, and task
  controls.
- [ ] Implement preview, sound, grouping, badge, and foreground rules.
- [ ] Make cold, warm, and foreground taps idempotently open the exact authorized
  message, thread, or task.

### Phase 4 — automated hardening

- [ ] Cover event eligibility, preference precedence, membership separation,
  access loss, duplicate scheduling, retries, receipt errors, token rotation,
  sign-out/account switch, privacy copy, and deep-link validation.
- [ ] Run the repository's full lint, typecheck, test, audit, and build gate.
- [ ] Run one bounded `codex review` on the nontrivial implementation and resolve
  actionable findings.

### Phase 5 — physical-device release proof

- [ ] Install a uniquely identified development or preview build on one physical
  iPhone and one physical Android device.
- [ ] Exercise foreground-other-context, foreground-exact-context, background,
  and terminated delivery for messages, threads, and tasks.
- [ ] Verify permission allow/deny/recovery, preview on/off, mute precedence,
  sign-out/account switch, token refresh, access revocation, offline tap,
  duplicate prevention, badges, sounds, and exact navigation.
- [ ] Inspect client and backend logs for errors and reconcile observed attempts
  with provider results.
- [ ] Update release notes and stop before production rollout.

## Definition of done

The feature is done only when every implementation-phase checkbox is complete
and observed. In particular:

1. An eligible event produces exactly one intended alert per active installation
   for the exact recipient membership, and self-authored or muted events produce
   none.
2. Sign-out, account switching, token rotation, reinstall, and invalid-token
   handling cannot deliver one account's notification to another account.
3. Notification copy, badges, grouping, metrics, logs, and deep links preserve
   current Project, Channel, thread, task, and Acting Company access.
4. Cold, warm, and foreground taps open the exact authorized context once, or a
   safe unavailable state after access loss.
5. Transient failures retry within the approved lifetime, permanent failures
   disable the token, duplicate jobs converge, and every terminal outcome is
   observable without content-bearing logs.
6. The complete automated gate passes, and one physical iOS device plus one
   physical Android device pass the foreground, background, and terminated
   matrix with no relevant client-console or backend errors.

Production credential changes, deployment, and rollout remain outside this
definition of done until explicitly approved in the active thread.
