# Mobile Push Notifications Specification

Status: implemented in code. Non-production physical-device release proof
remains required.

Companion: [operations runbook](./MOBILE_PUSH_NOTIFICATIONS_RUNBOOK.md)

## Product intent

Track notifications extend Project conversation and task work onto the device
with WhatsApp-like immediacy. Every eligible event is attempted promptly, and a
full preview shows the useful message or task content needed to decide whether
to open the app.

Aggressive delivery does not bypass operating-system permission, explicit mute
controls, Project or Channel access, user-selected preview privacy, or platform
delivery limits. A notification is always scoped to the exact recipient
membership that made it eligible.

The key terms are:

- **eligible event**: an event that passes current access, notification
  preferences, self-notification rules, and installation ownership;
- **installation**: one installed copy of Track with its native APNs or FCM
  token, platform, environment, permission state, and current account;
- **delivery intent**: the durable record that one eligible event should be
  attempted for one membership and installation;
- **provider acceptance**: APNs or FCM accepted the request, which does not prove
  that the device displayed it; and
- **exact context**: the Project membership, Acting Company, Channel, thread,
  message, or task required to authorize the destination.

## Product boundaries

- The release applies to iOS and Android. Existing web push remains a separate,
  context-only path.
- Companies collaborate through Projects and joined Channels. Notifications do
  not introduce direct messages or an audience outside those boundaries.
- A thread inherits its parent Channel audience and access checks.
- Tapping a notification always reauthorizes the destination. A stale push
  cannot confirm content to someone whose access was removed.
- Duplicate delivery and self-notification are product failures.
- Company-model notification state belongs to the exact selected Project
  membership; memberships are never merged merely because they belong to one
  human.
- Marketing pushes, broadcast campaigns, video-conference notifications, and
  silent background data sync are outside this release.
- Production deployment, credential changes, and rollout require explicit
  approval naming the production target.

## Eligible events

| Source | Eligible events | Recipient rule |
| --- | --- | --- |
| Channel timeline | Every new message or attachment | Active Channel members whose effective Channel preference allows it; never the author |
| Channel thread | New replies in a followed thread | Active Channel members following that thread; never the author |
| Important conversation activity | A direct mention or direct reply | The exact mentioned membership or author of the replied-to message, even in mentions-only mode; an explicit mute still wins |
| Tasks | Assignment, assignment loss, mention, due soon, and overdue | The exact active Project membership affected by the event |
| Followed tasks | New comments and meaningful task changes | Followers whose task preference includes all followed activity |

Edits, deletes, read receipts, typing, reactions, routine task-rank changes,
assistant streaming tokens, imports, and administrative audit events do not
create mobile pushes.

Eligibility is evaluated in this order:

1. Current Company, Project, Channel, thread, task, and membership access.
2. Active installation ownership and the last permission state observed by the
   app.
3. Explicit mute for the applicable Channel, thread, or task category.
4. Global conversation and task notification modes.
5. Channel override, thread-follow state, and task-follow state.
6. Event importance, including a direct mention, direct reply, assignment, and
   deadline event.
7. Foreground suppression when the exact context is already visible.

Operating-system Focus modes remain the quiet-hours mechanism. Track does not
add a second scheduler in this release.

## Permission and settings

Track explains notification value before triggering the one-time system prompt.
The trigger is an explicit action after the user has entered a Project and can
understand the benefit. The Notifications screen remains available before and
after the prompt.

The screen exposes:

- system permission state, an enable action, or a device-settings shortcut;
- conversation default: all messages, mentions and replies, or off;
- task default: important, all followed activity, or off;
- preview mode: full content, context only, or hidden;
- sound and badge controls; and
- a test-notification action.

Existing per-Channel overrides and thread-follow controls remain close to their
conversation surfaces.

## Notification copy and privacy

The default `full` mode includes a normalized message body or task title:

- title: **Bilal · #launch-readiness**;
- body: **The production build is ready for review.**;
- task title: **T-184 · Mobile release**; and
- task body: **You were assigned: Prepare the launch checklist**.

Full previews intentionally send bounded work content directly to Apple or
Google. Expo does not receive or relay the payload. Direct provider transport
reduces the number of processors but does not create end-to-end encryption;
Apple, Google, and the device operating system still participate in delivery.
The device's lock-screen preview and Focus settings remain authoritative.

The `context` mode includes the sender, event kind, and work location without a
message body, task title, description, filename, attachment text, evidence, AI
output, or imported memory. The `hidden` mode identifies only Track and a safe
event kind without sender, Company, Project, Channel, thread, task, message, or
file context. Web push always uses context mode.

Badge values come from currently authorized unread state rather than
incremental push arithmetic. Notifications may group visually by exact Project
membership and Channel or task, but grouping never combines eligible events
into one delivery.

## Delivery architecture

### Transport

The mobile app uses `expo-notifications` only as its native client integration.
It requests system permission, obtains the native device token with
`getDevicePushTokenAsync`, observes token rotation, presents foreground alerts,
and handles notification taps.

Convex sends:

- iOS alerts directly to the appropriate APNs HTTP/2 endpoint with an ES256
  provider token and `ai.q9labs.track` topic; and
- Android alerts directly through the Firebase Admin SDK to the registration
  token for package `ai.q9labs.track`.

Development installations use the APNs sandbox endpoint and development
topic-specific key. Preview and production installations use the production
endpoint and production topic-specific key. Android uses Firebase project
`track-494517` in every environment, with Track's environment boundary enforced
by the installation and Convex deployment.

The sender accepts at most 100 intents per internal batch, partitions them by
platform and APNs environment, and preserves input/result order. FCM uses one
per-message response from `sendEach`; APNs uses one HTTP/2 response per token.

### Source-of-truth records

- `pushInstallations`: stable installation id, owning account, platform,
  environment, native token, optional legacy Expo token, permission state,
  app version, enabled state, failure reason, and timestamps.
- `pushDeliveryIntents`: source event and kind, exact recipient account and
  membership, installation, idempotency key, routing data, presentation
  choices, retry state, expiry, and timestamps.
- `pushDeliveryAttempts`: attempt number, provider message id when available,
  sanitized result category, provider latency, and timestamps.
- `pushNotificationEvents`: content-free aggregate counts for source events and
  resolved targets.

The intent holds its bounded title and body only while delivery may retry.
Every terminal transition replaces those fields with generic empty copy.
Metrics, logs, attempt rows, and error reports never contain message bodies,
task titles, filenames, person names, Company names, Channel names, tokens, or
raw provider payloads.

Legacy Expo tokens remain readable so upgrades and account detachment are
non-destructive. They are ineligible for delivery. Track does not call the Expo
send or receipt APIs.

### Lifecycle

1. The event mutation writes its domain change and schedules notification
   resolution.
2. The resolver checks recipients, current access, preferences,
   self-notification, and installation ownership.
3. One intent is created for each exact recipient membership and active
   installation. Its idempotency key prevents duplicate scheduling.
4. Immediately before submission, the sender rechecks eligibility and native
   token ownership.
5. APNs or FCM provider acceptance creates a terminal accepted attempt.
6. Retryable network, provider-availability, and rate-limit failures use bounded
   exponential backoff, at most five attempts, and the intent lifetime.
7. A permanent invalid-token response clears and disables that installation
   until the app registers a fresh token.
8. A recovery cron returns interrupted sending attempts to the same bounded
   retry path. A compatibility cron expires unresolved historical Expo receipt
   records without contacting Expo.
9. An authorized notification open is recorded once without analytics content.

Sign-out detaches the installation before local credentials disappear. Signing
into another account atomically claims the same installation and makes the
previous association ineligible. Token rotation updates the installation
instead of creating another target.

## Presentation and navigation

When Track is foregrounded elsewhere, the alert appears normally. When the
exact message, thread, or task is already visible, Track suppresses the
redundant platform banner and lets the live interface present the event.

Android uses separate audible and silent channels because channel sound is
immutable after creation. iOS chooses sound per payload. Platform settings may
override either choice.

The payload contains a versioned internal route and opaque identifiers. It is
untrusted input. On cold, warm, or foreground tap, Track validates its shape,
restores the encoded Project membership and Acting Company, asks Convex to
authorize the target, and then opens the exact message, thread, or task. Each
notification response is consumed once. If access changed, Track opens a safe
unavailable state that does not confirm hidden content.

## Failure behavior

| Condition | Required outcome |
| --- | --- |
| Permission not determined | Explain the benefit and let the user trigger the system prompt |
| Permission denied | Do not prompt repeatedly; show disabled state and a device-settings shortcut |
| Token unavailable or refresh fails | Keep the app usable and retry registration on a later foreground transition |
| Sign-out or account switch | Detach the installation from the old account before removing the local session |
| Duplicate event scheduling | Converge on one intent per recipient membership and installation |
| Transient provider or network error | Retry within the event lifetime with bounded backoff and observable attempt state |
| Permanent invalid-token response | Clear the token, retain the installation, and request a new token later |
| Access or preference changes before send | Cancel and redact the intent |
| Access changes after send but before tap | Reauthorize and open a safe unavailable state |
| App offline when tapped | Preserve the route, show connection state, and authorize after reconnect |
| Foreground exact context | Suppress the duplicate platform alert |

## Measurement and release proof

During normal provider availability, the service objective is for 95% of
eligible intents to receive direct provider acceptance within five seconds and
99% within thirty seconds. Track records eligible events, created and canceled
intents, provider latency, acceptance, retries, expirations, invalid-token rate,
authorized opens, duplicate-open suppression, and installation registration
state.

Provider acceptance does not prove device display. A release is complete only
after the full automated gate passes and one physical iPhone plus one physical
Android device pass:

- message, thread, and task delivery while the app is foregrounded elsewhere,
  foregrounded on the exact context, backgrounded, and terminated;
- full, context, and hidden copy;
- permission allow, deny, and recovery;
- mute precedence, badge and sound choices;
- sign-out, account switch, token refresh, and access revocation;
- offline tap recovery, exact navigation, and duplicate prevention; and
- clean client and backend logs matched to provider attempts.

Production deployment and rollout remain outside this proof until explicitly
approved in the active thread.
