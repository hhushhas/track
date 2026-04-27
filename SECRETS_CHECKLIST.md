# Track Secrets Checklist

No secret values should be committed to this file.

The real local secret file is:

```text
.env
```

It is gitignored and should be preserved locally.

## Runtime Secrets

```text
OPENROUTER_API_KEY
AUTH_SECRET
TOTP_ENCRYPTION_SECRET
CONVEX_DEPLOY_KEY
CONVEX_DEPLOY_KEY_DEV
CONVEX_DEPLOY_KEY_PROD
CLOUDFLARE_API_TOKEN
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
AXIOM_TOKEN
AXIOM_ORG_ID
```

Local variable names are mirrored in `.env.example`. Actual local values are stored in `.env`.

## Google OAuth

```text
GOOGLE_CLIENT_ID_WEB
GOOGLE_CLIENT_SECRET_WEB
GOOGLE_CLIENT_ID_IOS
GOOGLE_CLIENT_ID_ANDROID_UPLOAD
GOOGLE_CLIENT_ID_ANDROID_PLAY_SIGNING
```

## Mobile / EAS / Store Credentials

Stored locally under:

```text
scratchpad/credentials/
```

Credential material in that folder must remain local-only.

## Known Status

```text
OpenRouter API key: provided out-of-band in chat, not recorded here
Local .env: created on 2026-04-27
OpenRouter key expiry: 2026-10-24 09:53 GMT+5
Convex project: track
Convex development cloud URL: https://enduring-impala-781.convex.cloud
Convex development HTTP actions URL: https://enduring-impala-781.convex.site
Convex production cloud URL: https://fleet-manatee-941.convex.cloud
Convex production HTTP actions URL: https://fleet-manatee-941.convex.site
Convex deploy keys: stored in local .env only
Google Cloud project: track-494517
Bundle/package id: ai.q9labs.track
Production domain: track.q9labs.ai
Web push VAPID keys: generated locally on 2026-04-27
Web push VAPID subject: mailto:support@q9labs.ai
Web push VAPID local file: scratchpad/credentials/track-web-push-vapid.env
Observability sink: Axiom
Observability dataset: track
```

## Storage Locations

Use provider secret stores for production values:

```text
Convex deployment env vars
Cloudflare Worker secrets
Expo/EAS credential store
Apple Developer / App Store Connect
Google Play Console
Google Cloud Console
```
