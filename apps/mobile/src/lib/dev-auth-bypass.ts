import { useEffect, useState } from 'react';
import { devAuthBypassUser, shouldAllowDevAuthBypass } from '@track/shared';

import { authClient } from './auth-client';

const devAuthBypassPassword = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS_PASSWORD;

const isDevAuthBypassAllowed = Boolean(
  devAuthBypassPassword && shouldAllowDevAuthBypass({
    flag: process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS,
    isDev: process.env.NODE_ENV !== 'production',
  }),
);

const listeners = new Set<() => void>();
let enabled = false;

function emitDevAuthBypassChanged() {
  for (const listener of listeners) listener();
}

export async function enableDevAuthBypass() {
  if (!isDevAuthBypassAllowed || !devAuthBypassPassword) {
    throw new Error('dev_auth_bypass_disabled');
  }

  const signIn = await authClient.signIn.email({
    email: devAuthBypassUser.email,
    password: devAuthBypassPassword,
    callbackURL: '/',
  });
  if (signIn.error) {
    const signUp = await authClient.signUp.email({
      email: devAuthBypassUser.email,
      password: devAuthBypassPassword,
      name: devAuthBypassUser.displayName,
      callbackURL: '/',
    });
    if (signUp.error) throw new Error('dev_auth_sign_in_failed');
  }

  enabled = true;
  emitDevAuthBypassChanged();
}

export function disableDevAuthBypass() {
  enabled = false;
  emitDevAuthBypassChanged();
}

export function useDevAuthBypass() {
  const [active, setActive] = useState(enabled);

  useEffect(() => {
    const listener = () => setActive(enabled);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    allowed: isDevAuthBypassAllowed,
    enabled: active,
    enable: enableDevAuthBypass,
    disable: disableDevAuthBypass,
  };
}
