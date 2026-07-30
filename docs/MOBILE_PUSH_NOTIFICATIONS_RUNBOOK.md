# Mobile Push Notifications Runbook

Status: direct APNs and FCM delivery is implemented. Production rollout remains
a separate approval. Each release candidate still requires physical-device
proof because simulators cannot prove remote APNs or FCM delivery.

## Runtime contract

Convex owns installation attachment, eligibility, preferences, notification
copy, delivery intents, attempts, retries, and diagnostics. Convex sends iOS
notifications directly to APNs and Android notifications directly through the
Firebase Admin SDK. Apple and Google own provider acceptance and final device
presentation.

The mobile app continues to use the `expo-notifications` client library for
operating-system permission, native-token registration, foreground handling,
and notification taps. It calls `getDevicePushTokenAsync`, so the backend
receives an APNs device token on iOS or an FCM registration token on Android.
The Expo Push Service is not in the delivery path.

Native delivery uses these records:

- `pushInstallations` stores one installed app, its current account, platform,
  environment, permission state, native token, app version, and safe failure
  state;
- `pushNotificationEvents` stores aggregate source-event and target counts;
- `pushDeliveryIntents` stores one idempotent delivery per exact recipient
  membership and installation; and
- `pushDeliveryAttempts` stores provider acceptance, latency, retry, and
  terminal state.

An intent temporarily contains the selected notification title and body so a
retry sends consistent copy. Track replaces both fields with generic empty copy
as soon as the intent becomes terminal. Tokens, payloads, names, and work
content are excluded from operational metrics.

Older app releases may still register an Expo token. Track preserves those
records for a non-destructive upgrade, but it never submits them to Expo. The
next app registration replaces the legacy token with a native token.

## Preview and privacy contract

The default `full` preview provides the WhatsApp-like experience:

- message notifications contain a normalized, bounded message body or an
  attachment fallback;
- task notifications contain the bounded task title; and
- the title identifies the sender and Channel or the task key and Project.

The `context` option excludes message bodies and task titles while retaining
safe sender and work-location context. The `hidden` option excludes sender,
Company, Project, Channel, thread, task, message, and file context. Web
notifications remain context-only.

Full previews send work content to Apple or Google as part of the native
notification payload. They avoid Expo processing but are not end-to-end
encrypted and remain subject to the device's notification-preview, Focus, and
lock-screen settings. Users who do not want work content in provider payloads
must select `context` or `hidden`.

## Environment configuration

Client and server environments must match. A development installation cannot
receive a preview or production deployment's intents.

Client build values:

```text
EXPO_PUBLIC_APP_ENV=development|preview|production
EXPO_PUBLIC_CONVEX_URL=<matching Convex deployment>
EXPO_PUBLIC_CONVEX_SITE_URL=<matching Convex site>
GOOGLE_SERVICES_JSON=<Android app configuration file>
```

The Expo configuration must include `expo-notifications`. iOS needs the push
notification entitlement for `ai.q9labs.track`; Android needs the
`google-services.json` belonging to Firebase project `track-494517` and package
`ai.q9labs.track`. `apps/mobile/app.config.ts` passes
`GOOGLE_SERVICES_JSON` to Expo Prebuild when present. Keep build credentials
outside the repository and provide hosted builds with an EAS file variable.

Convex server values:

```text
TRACK_PUSH_ENVIRONMENT=development|preview|production

APNS_TEAM_ID=<Apple developer team id>
APNS_BUNDLE_ID=ai.q9labs.track
APNS_DEVELOPMENT_KEY_ID=<sandbox topic-specific key id>
APNS_DEVELOPMENT_PRIVATE_KEY=<sandbox .p8 contents>
APNS_PRODUCTION_KEY_ID=<production topic-specific key id>
APNS_PRODUCTION_PRIVATE_KEY=<production .p8 contents>

FCM_V1_SERVICE_ACCOUNT_JSON=<complete service-account JSON>
FCM_ANDROID_PACKAGE=ai.q9labs.track
```

Development uses `api.development.push.apple.com` and the development APNs key.
Preview and production use `api.push.apple.com` and the production APNs key. A
combined APNs key can use the fallback `APNS_KEY_ID` and `APNS_PRIVATE_KEY`
values, but separate topic-specific keys are preferred.

The Firebase service account needs only permission to send FCM messages.
Credential source files belong under the ignored `.credentials/` directory or
in the approved secrets manager. The checked-in `.env.example` contains file
pointers for operator tooling; Convex receives the file contents in the runtime
variables above. Web push continues to use separate VAPID values.

## Delivery operation

1. A message or task effect resolves current access, self-notification rules,
   global and scoped preferences, thread following, and installation ownership.
2. Idempotency creates at most one intent for the source event, exact recipient
   membership, and installation.
3. Immediately before sending, the action rechecks eligibility and token
   ownership. It dispatches at most 100 intents per internal batch, partitioned
   by APNs environment and FCM platform.
4. An APNs HTTP/2 success or Firebase message id records provider acceptance.
   This does not prove that the operating system displayed the alert.
5. Network, provider-availability, and rate-limit failures retry up to five
   attempts with exponential backoff capped at 30 seconds and within the
   intent's lifetime.
6. Invalid or unregistered device tokens clear and disable that installation.
   Credential and payload failures retain only a sanitized category.
7. A one-minute recovery cron returns interrupted `sending` intents to the
   bounded retry path after two minutes. A separate compatibility cron expires
   unresolved receipt records created by the retired Expo sender without
   contacting Expo.

Use `pushDelivery.getOperationalMetrics` for bounded aggregate counts. The
mobile Notifications screen exposes only the current user's recent intent
counts and provider-acceptance latency.

After configuring a non-production deployment, run the internal
`pushNotifications:verifyNativeProviderConnectivity` action. It submits
deliberately nonexistent APNs and FCM tokens with no work content. A
`device_not_registered` result from each provider proves credential and network
connectivity; `invalid_credentials` is a configuration failure.

## Client operation

Track explains notifications after the user enters a Project. Only an explicit
tap requests operating-system permission. A denied permission is not prompted
again; the Notifications screen opens device settings instead. Registration is
retried on app foreground and native-token refresh.

Android creates separate high-priority audible and silent notification channels
because channel sound behavior is immutable after creation. iOS selects sound
per APNs payload.

Sign-out detaches the installation while the authenticated session still
exists. If that request cannot complete, Track keeps the session and explains
that it could not safely disconnect notifications. Account deletion detaches
and removes both native and legacy tokens server-side.

Foreground presentation compares the payload's Project, Channel, thread, or
task with the focused route. The exact visible context uses its live UI and
suppresses the redundant platform banner. Other contexts retain banners and
the selected sound. Taps accept only supported internal route shapes,
reauthorize through the destination query, and consume each response once.

## Release verification

Automated verification covers eligibility, mute precedence, direct mentions
and replies, task modes, all three preview modes, idempotent intent creation,
provider failure classification, retries, invalid tokens, token rotation,
account switching, sign-out, routing, and foreground suppression.

Simulator checks can prove native compilation, permission education, allow and
deny UI, device-settings recovery, local foreground presentation, tap routing,
and client logs. They do not prove remote delivery.

Before any rollout, install a uniquely named development or preview build on a
physical iPhone and Android device. Against the matching non-production
backend, verify foreground-other-context, foreground-exact-context, background,
and terminated delivery for a Channel message, thread reply, and task event.
Verify full/context/hidden copy, mutes, sound, badge, access revocation, offline
tap recovery, sign-out, account switching, token refresh, duplicate prevention,
provider attempts, and clean client/backend logs.

Do not change production runtime values, deploy production code, or roll out a
build without explicit approval naming the production target.
