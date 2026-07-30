import Constants from 'expo-constants';

import { hasUsableStoredAuthSession } from '@/lib/auth-storage-core';
import { platformStorage } from '@/lib/platform-storage';

const scheme = Array.isArray(Constants.expoConfig?.scheme)
  ? Constants.expoConfig?.scheme[0]
  : Constants.expoConfig?.scheme;

export const authStoragePrefix = scheme ?? 'track';

const authCookieKey = `${authStoragePrefix}_cookie`;
const authSessionCacheKey = `${authStoragePrefix}_session_data`;

export function hasStoredAuthSession() {
  return hasUsableStoredAuthSession({
    cookie: readAuthStorage(authCookieKey),
    sessionCache: readAuthStorage(authSessionCacheKey),
  });
}

export function clearStoredAuthSession() {
  writeAuthStorage(authCookieKey, '{}');
  writeAuthStorage(authSessionCacheKey, '{}');
}

function readAuthStorage(key: string) {
  try {
    return platformStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeAuthStorage(key: string, value: string) {
  try {
    platformStorage.setItem(key, value);
  } catch {
    // Best effort cleanup. Better Auth will also clear its in-memory session.
  }
}
