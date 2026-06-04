# Changelog

## 2026-06-04

- Fixed production Google sign-in by ensuring the Cloudflare Worker and browser client have the Convex production URLs and by explicitly following the OAuth redirect returned by Better Auth.
- Added local Track Assistant text extraction for `.docx` and plain text attachments so common documents can be read even when the model file reader rejects uploaded files.

## 2026-05-23

- Fixed mobile sign-out and delete-account crashes by removing automatic native notification permission checks from auth startup.
- Added native auth-session restore handling so the mobile app does not redirect to sign-in while a persisted Better Auth session is still rehydrating.

## 2026-05-17

- Replaced the mobile app icon, splash, in-app mark, Android adaptive icon layers, favicon, and sign-in Google icon with assets derived from the official web Track logo set.
- Polished the mobile sign-in surface, icon buttons, row icons, conversation bubbles, account actions, and scrollable option sheets, including an exposed Sign out action.

## 2026-05-16

- Implemented the mobile v1 conversation scope with native Project/Group navigation, unread counts, conversation composer, attachments, voice notes, Track Assistant answers, reporting, notification preferences, account deletion, Apple sign-in configuration, and store-readiness notes.
- Added mobile backend contracts for Project/Group lists, read state, native push token registration/delivery, content reports, last active context, and account deletion requests.
- Added public Terms and in-app Privacy/Terms/Support access for mobile store review readiness.

## 2026-05-01

- Decomposed the workspace page into focused chat, sidebar, header, rail, search, records, settings, and hook modules.
- Added regression coverage for route state, record filtering, search result shaping, mentions, message sending, and notification body copy.
- Improved workspace notification diagnostics, pending attachment handling, project record export flows, and assistant/chat data shaping.
- Added a committed Convex production deploy selector so `pnpm convex:deploy:prod` targets `fleet-manatee-941` even when local dev env files are present.

## 2026-04-29

- Added email/password access next to Google sign-in, including new-email account creation and the Google-proof flow for adding a password to an existing Google account.
- Added profile onboarding and profile settings for display name, designation, timezone, avatar, and bio.
- Added optional two-factor setup with authenticator apps, trusted devices, backup-code verification, and Track step-up freshness storage for sensitive actions.
- Polished profile settings UI with workspace navigation, provider icons, a custom timezone picker, 2FA status summaries, and richer teammate hover cards.
- Refined profile settings polish with flatter navigation, cleaner tab styling, top-aligned 2FA actions, member avatar URLs in hover cards, and avatar-derived card banners.
- Flattened profile onboarding into a single form surface and wired project export actions through a reusable two-factor step-up prompt.
- Reworked protected-action verification into a non-blocking floating 2FA panel and added a security-settings reset for the 10-minute grace period.
- Cleaned up the security settings hierarchy and showed stored profile photos in message row avatars.
- Enforced export 2FA step-up on the server and preserved 2FA state during workspace auth sync so CSV/PDF exports cannot bypass the prompt.
- Refined the sign-in screen into a flatter split layout with cleaner inputs, password visibility toggles, a single-line divider, clearer branding, and an icon-led email action.
- Added two interactive sign-in comparison routes with animated Track conversation previews for evaluating live-message entrance treatments.
- Improved the option B sign-in preview with transparent logo artwork, a higher page anchor, more conversation rows, and an infinite masked feed animation.
- Promoted the option B conversation-feed sign-in experience to the official `/sign-in` page.
- Updated privacy language for email/password auth, two-factor data, and expanded profile fields.
