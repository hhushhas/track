# Changelog

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
- Updated privacy language for email/password auth, two-factor data, and expanded profile fields.
