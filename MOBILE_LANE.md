# Track Mobile Lane Agent Guide

This is the handoff for any agent owning Track's mobile lane: Expo, EAS, React Native, Android, iOS, App Store Connect, Google Play, mobile OAuth, push credentials, store submissions, and mobile release verification.

Do not treat this as a generic Expo note. This records the actual Track setup, the account split, the known-good commands, and the mistakes already paid for once.

## Operating Rules

- Work from `/Users/macmini/Desktop/Code/track`.
- Use `pnpm`, not `npm`.
- Keep changes scoped. Do not use `git add .`.
- Assume the worktree may already be dirty. Read `git status --short --branch` before building, committing, submitting, or deploying.
- Do not run EAS production builds from an accidental dirty state. Commit the intended mobile/package changes first, or be explicit that a dirty local archive is desired.
- Never paste keystore passwords, `.p8`, `.p12`, service account JSON contents, Google client secrets, or deploy keys into chat or docs.
- It is fine to record secret file paths and public IDs.
- For browser work, use the account specified below. If the browser account is wrong, switch accounts before changing store/cloud settings.

## Account Map

| Surface | Account / Team | Notes |
|---|---|---|
| Expo | `q9labsai` | Project is `@q9labsai/track`. EAS CLI has been authenticated as `q9labs.ai@gmail.com` / `q9labs`. |
| Apple Developer | CollabEZ FZE LLC | Team ID `5K9635LZ6F`. |
| App Store Connect | `q9labs.ai@gmail.com` | App record is `Q9 Track`, ASC app ID `6763930104`. |
| Google Play Console | `hhushhas@gmail.com` | Choose developer account `COLLABEZ`. Developer account ID `6879250333337289437`. |
| Google Cloud | `q9labs.ai@gmail.com` | Project `track-494517`. |
| Cloudflare | `msbilal@gmail.com` | Web is served at `https://track.q9labs.ai`; mobile env points there. |
| GitHub | `hhushhas` | Repo is `hhushhas/track`; push target is `main`/`master` only. |

## Locked App Identifiers

| Item | Value |
|---|---|
| Expo owner/project | `@q9labsai/track` |
| Expo project ID | `fa6a7ca9-7e23-437b-a641-ae3ced55270e` |
| App display name | `Q9 Track` on iOS, `Track` on Play |
| Expo slug | `track` |
| iOS bundle ID | `ai.q9labs.track` |
| Android package | `ai.q9labs.track` |
| App Store Connect app ID | `6763930104` |
| Google Play app ID | `4975775109941853146` |
| Google Cloud project ID | `track-494517` |
| Production app URL | `https://track.q9labs.ai` |

## Important Files

| Path | Purpose |
|---|---|
| `apps/mobile/app.json` | Expo app config, bundle/package IDs, icons, plugins. |
| `apps/mobile/eas.json` | EAS build and submit profiles. |
| `apps/mobile/metro.config.js` | Monorepo Metro resolution for workspace packages and Convex generated imports. |
| `apps/mobile/.env.local` | Mobile public env values. It is intentionally gitignored. |
| `scratchpad/store-auth-preflight-2026-04-26.md` | Detailed provisioning history and external IDs. |
| `scratchpad/credentials/` | Local secret credential files. Do not commit or print contents. |
| `assets/brand/` | Brand masters and generated icon assets. |

## Current Credential Posture

Apple/iOS is provisioned:

- Apple Developer App ID exists for `ai.q9labs.track` with Push Notifications enabled.
- App Store Connect app record exists: `Q9 Track`, app ID `6763930104`.
- Distribution certificate exists and is uploaded to Expo.
- App Store provisioning profile exists and is uploaded to Expo.
- APNs auth key exists and is uploaded to Expo.
- App Store Connect API key exists and is uploaded to Expo for EAS Submit.

Android/Google is provisioned:

- Google Play app shell exists for package `ai.q9labs.track`.
- Android upload keystore exists locally and is uploaded to Expo.
- Google Cloud project `track-494517` exists.
- FCM V1 service account key exists and is uploaded to Expo.
- Google Play / EAS Submit service account exists and is uploaded to Expo.
- Play submit service account has app-specific testing-track release permission only.
- Production release permission has not been granted.

Credential paths recorded in the preflight note:

- `scratchpad/credentials/track-android-upload-keystore.jks`
- `scratchpad/credentials/track-android-upload-keystore.p12`
- `scratchpad/credentials/track-android-upload-keystore.env`
- `scratchpad/credentials/track-ios-distribution.*`
- `scratchpad/credentials/track-ios-app-store.mobileprovision`
- `scratchpad/credentials/track-ios-apns-auth-key-2WPBQ272YG.p8`
- `scratchpad/credentials/track-asc-api-key-HAGJPS9XU4.p8`
- `scratchpad/credentials/track-fcm-v1-service-account.json`
- `scratchpad/credentials/track-play-submit-service-account.json`

## OAuth

Google Auth Platform is configured and published to production in project `track-494517`.

Web callback URIs:

- `https://track.q9labs.ai/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

OAuth client IDs:

| Client | ID |
|---|---|
| Web | `264239936985-0f3vsi32ibur3171gr3ej7abgh1ushq7.apps.googleusercontent.com` |
| iOS | `264239936985-eos42o453enblf3mspu7lt5o96r4e6uh.apps.googleusercontent.com` |
| Android upload key | `264239936985-bk1ppudb55qhq9j71om5cq3li4tc22g4.apps.googleusercontent.com` |
| Android Play App Signing | `264239936985-23ed286kpgt0724rpgln43360s10fb28.apps.googleusercontent.com` |

Android OAuth has both signing paths covered:

- Upload-key SHA-1: `1A:4C:A0:BF:1D:CA:A6:29:EB:99:F7:0F:36:BE:8B:19:9E:06:68:51`
- Play App Signing SHA-1: `16:94:82:25:DE:20:83:6D:6B:86:74:97:9F:F4:7C:DB:1F:63:84:47`

If Android Google sign-in fails only after Play distribution, re-check the Play App Signing SHA-1 client first.

## Known-Good Build Commands

From repo root:

```bash
pnpm --filter @track/mobile lint
pnpm --filter @track/mobile typecheck
```

From `apps/mobile`:

```bash
npx expo-doctor
npx expo export --platform android --output-dir /tmp/track-mobile-export --clear
eas build:list --limit 6
eas build -p android --profile production --non-interactive
eas build -p ios --profile production --non-interactive
eas build -p all --profile production --non-interactive
```

Useful build inspection:

```bash
eas build:view <build-id>
eas build:view <build-id> --json
```

Submission command shape:

```bash
eas submit -p android --profile production --latest --wait --non-interactive
eas submit -p ios --profile production --latest --wait --non-interactive
eas submit -p all --profile production --latest --wait --non-interactive
```

This EAS CLI does not support `eas submit:list`. Use `eas submit --help`, EAS dashboard, or submission output from the submit command.

## Current Build Baseline

The last confirmed finished production builds from the mobile bundling fix are:

| Platform | Build ID | Status | Version | Commit |
|---|---|---|---|---|
| Android | `561a73ef-b96f-4d4f-959d-346d8d72d37c` | `FINISHED` | version code `6` | `6f8747f` |
| iOS | `3f0dd007-3d0f-42b7-b111-e5354341aa40` | `FINISHED` | build number `6` | `6f8747f` |

Important: `main` later moved past `6f8747f`. Before claiming mobile is current, run fresh production builds from the current committed `main`.

## EAS Config Posture

`apps/mobile/eas.json` uses:

- `cli.appVersionSource: "remote"`
- `production.autoIncrement: true`
- `EXPO_PUBLIC_APP_URL: "https://track.q9labs.ai"`
- iOS submit target:
  - `appleId: "q9labs.ai@gmail.com"`
  - `ascAppId: "6763930104"`
- Android submit target:
  - `track: "internal"`

Android is currently configured for internal-track submission. Do not assume production rollout permission exists.

## Store Submission Notes

### Apple / TestFlight

Use the App Store Connect API key already uploaded to Expo. After successful submit, Apple can take time to process the build before it appears in TestFlight/App Store Connect.

Before public App Store submission, store listing assets/content and privacy answers must be complete.

### Google Play

The Play submit service account currently has testing-track release permission. This is enough for internal/testing-track automation, not necessarily production.

If production rollout automation is desired, grant app-specific production release permission in Play Console for:

`track-play-submit@track-494517.iam.gserviceaccount.com`

Do not broaden permissions unless asked.

## Store Asset Status

Store assets were generated under:

- `scratchpad/store-assets/play/`
- `scratchpad/store-assets/appstore/`

Use those as the starting point for listing uploads, but verify each current store requirement before final public submission.

## Push Notifications

Mobile push credentials are provisioned:

- Android FCM V1 key uploaded to Expo.
- iOS APNs auth key uploaded to Expo.

If push fails:

1. Confirm Expo credentials still show valid push credentials for `ai.q9labs.track`.
2. Confirm the installed build is a native EAS build, not Expo Go.
3. Confirm backend push token registration is actually called after login.
4. Confirm the app has OS-level notification permission.
5. For Android, confirm the FCM V1 project is `track-494517`.

## Mistakes Already Encountered

Avoid repeating these:

- `apps/mobile/app.json` cannot include unsupported Expo schema fields like `privacy` or `privacyPolicyUrl`; Expo Doctor rejected them.
- Expo SDK expected TypeScript `~5.9.2`, while the repo intentionally pins TypeScript 6. Keep the `expo.install.exclude` workaround in mobile package config unless the repo standard changes.
- `@better-auth/expo` required `expo-network`; missing it caused local native export failure.
- Mobile bundling failed to resolve `../../../../convex/_generated/api` until Metro was configured for the monorepo.
- Duplicate React versions caused invalid hook/SSR failures; keep React aligned across root, web, and mobile.
- Do not rely on `eas submit:list`; this EAS CLI does not have that command.
- The successful native build from `6f8747f` is not proof that later `main` commits build natively.

## Pre-Build Checklist

Run this before EAS production builds:

1. `git status --short --branch`
2. Confirm all intended mobile/package changes are committed.
3. Confirm no unrelated dirty files will be accidentally archived.
4. `pnpm --filter @track/mobile lint`
5. `pnpm --filter @track/mobile typecheck`
6. `cd apps/mobile && npx expo-doctor`
7. `cd apps/mobile && npx expo export --platform android --output-dir /tmp/track-mobile-export --clear`

Then run EAS builds.

## Post-Build Checklist

After EAS builds:

1. `eas build:list --limit 6`
2. Confirm latest Android and iOS builds are `FINISHED`.
3. Record build IDs, commit hashes, version code/build number, artifact type, and profile.
4. If submitting, run EAS submit with `--wait`.
5. Verify App Store Connect / Play Console received the uploaded build.
6. Record exact pending blocker if either store does not expose the build yet.

## When Blocked

Report the exact surface and error:

- EAS build ID and status.
- EAS log URL or failing log line.
- Store URL and visible UI state.
- Account currently selected.
- Missing permission or API.
- Whether the build was from committed `main` or a dirty local archive.

Do not summarize store/build failures as "EAS failed" without the concrete error text.
