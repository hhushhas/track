import { useEffect, useState } from 'react';
import { shouldAllowDevAuthBypass } from '@track/shared';

const isDevAuthBypassAllowed = shouldAllowDevAuthBypass({
  flag: process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS,
  isDev: process.env.NODE_ENV !== 'production',
});

const listeners = new Set<() => void>();
let enabled = false;

function emitDevAuthBypassChanged() {
  for (const listener of listeners) listener();
}

export function enableDevAuthBypass() {
  if (!isDevAuthBypassAllowed) return;
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
