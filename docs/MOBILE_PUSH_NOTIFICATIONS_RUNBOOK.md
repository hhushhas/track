# Mobile Push Notifications Runbook

Status: implemented delivery and client behavior. Production rollout remains a
separate approval. Physical-device release proof is required for each release
candidate because simulators cannot prove APNs or FCM delivery.

## Runtime contract

Convex owns installation attachment, eligibility, preferences, privacy-safe
copy, delivery intents, attempts, retries, receipts, and diagnostics. Expo is the
transport to APNs and FCM. Apple and Google own final presentation.

Native delivery uses these records:

- `pushInstallations` stores one installed app, its current account, platform,
  environment, permission state, Expo token, app version, and safe failure state;
- `pushNotificationEvents` counts source events and resolved targets without
  content or names;
- `pushDeliveryIntents` stores one idempotent delivery per exact recipient
  membership and installation; and
- `pushDeliveryAttempts` stores sanitized ticket, receipt, latency, retry, and
  terminal state.

Existing clients that call `registerNativeToken` lazily create a stable legacy
installation. Updated clients use a SecureStore installation id and
`registerNativeInstallation`; no content migration or destructive table rewrite
is required.

## Environment configuration

Client and server environments must match. A development app cannot receive a
preview or production deployment's intents.

Client build values:

```text
EXPO_PUBLIC_APP_ENV=development|preview|production
EXPO_PUBLIC_CONVEX_URL=<matching Convex deployment>
EXPO_PUBLIC_CONVEX_SITE_URL=<matching Convex site>
```

The Expo configuration must include `expo-notifications` and the EAS Project id.
iOS needs the APNs entitlement and EAS-managed APNs key. Android needs an FCM v1
service account associated with the package's Firebase project. Android builds
also require `GOOGLE_SERVICES_JSON` to point at the matching
`google-services.json`; `apps/mobile/app.config.ts` passes that file into Expo
Prebuild when the variable is present. Store it as an EAS file variable for
hosted builds or use an ignored local credential path. Keep credential files
outside the repository.

Convex values:

```text
TRACK_PUSH_ENVIRONMENT=development|preview|production
EXPO_PUSH_ACCESS_TOKEN=<Expo push access token>
```

Enable Expo's enhanced push security for the Project before setting
`EXPO_PUSH_ACCESS_TOKEN`. A mismatched or missing access token is a configuration
failure, not a reason to disable an installation. Web push continues to use its
separate VAPID values.

The checked-in example configuration is safe metadata. `apps/mobile/app.json`,
`apps/mobile/eas.json`, APNs material, Firebase service accounts, and generated
native projects remain ignored operator state.

## Delivery operation

1. A message or task effect resolves active access, self-notification rules,
   global and scoped preferences, thread following, and installation ownership.
2. Idempotency creates at most one intent for the source event, exact recipient
   membership, and installation.
3. The sender rechecks eligibility, submits at most 100 messages per Expo
   request, and records one attempt per intent.
4. Network, provider-availability, and rate-limit failures retry up to five
   attempts with exponential backoff capped at 30 seconds and within the intent
   lifetime.
5. One five-minute cron reconciles ticket ids once they are at least 15 minutes
   old. Missing receipts remain pending and become classified expiry after 20
   minutes without creating one receipt job per installation.
6. `DeviceNotRegistered` removes the token and disables delivery until the app
   registers a fresh token. Other permanent failures retain a sanitized category
   for diagnosis.
7. A one-minute recovery cron returns interrupted `sending` intents to the
   bounded retry path after two minutes so an action interruption cannot strand
   them indefinitely.

Use the internal `pushDelivery.getOperationalMetrics` query for bounded aggregate
counts. The mobile Notifications screen exposes only the current user's recent
intent counts and acceptance latency. Neither view contains payloads, names,
tokens, or work content.

## Client operation

Track shows its explanation after the user enters a Project. Only an explicit
tap requests operating-system permission. A denied permission is never prompted
again; the Notifications screen opens device settings instead. Registration is
retried on app foreground and token refresh.

Sign-out detaches the installation while the authenticated session still exists.
If that request cannot complete, Track keeps the session and explains that it
could not safely disconnect notifications. Account deletion detaches and removes
the token server-side.

Foreground presentation compares the payload's Project, Channel, thread, or task
with the focused route. The exact visible context uses its live UI and suppresses
the redundant platform banner. Other contexts retain banners and the selected
sound. Taps accept only supported internal route shapes, reauthorize through the
destination query, and consume each notification response once.

## Release verification

Automated verification must cover eligibility, mute precedence, direct mentions
and replies, task modes, privacy copy, idempotent intent creation, retries,
receipts, invalid tokens, token rotation, account switching, sign-out, routing,
and foreground suppression.

Simulator checks prove native compilation, permission education, allow and deny
UI, device-settings recovery, local foreground presentation, tap routing, and
client logs. They do not prove remote delivery.

Before any rollout, install one uniquely named development or preview build on a
physical iPhone and Android device. With non-production credentials and backend,
verify foreground-other-context, foreground-exact-context, background, and
terminated delivery for a Channel message, thread reply, and task event. Also
verify preview hidden/context, mutes, sound, badge, access revocation, offline
tap recovery, sign-out, account switching, token refresh, duplicate prevention,
provider attempts, receipts, and clean client/backend logs.

Do not change production credentials, deploy, or roll out from this runbook
without explicit approval naming the production target.
