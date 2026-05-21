import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const scheme = Array.isArray(Constants.expoConfig?.scheme)
  ? Constants.expoConfig?.scheme[0]
  : Constants.expoConfig?.scheme;

const authBaseURL = process.env.EXPO_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

let twoFactorRedirectHandler: ((methods: string[]) => void) | null = null;

export function setTwoFactorRedirectHandler(handler: ((methods: string[]) => void) | null) {
  twoFactorRedirectHandler = handler;
}

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    expoClient({
      scheme: scheme ?? 'track',
      storagePrefix: scheme ?? 'track',
      storage: SecureStore,
    }),
    convexClient(),
    twoFactorClient({
      onTwoFactorRedirect: ({ twoFactorMethods }) => {
        twoFactorRedirectHandler?.(twoFactorMethods ?? ['totp', 'backup_code']);
      },
    }),
  ],
});
