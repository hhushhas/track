type StoredCookie = {
  value?: unknown;
  expires?: unknown;
};

type StoredSession = {
  user?: { id?: unknown } | null;
  session?: { id?: unknown; expiresAt?: unknown } | null;
};

export type StoredAuthPayload = {
  cookie: string | null;
  sessionCache: string | null;
};

export function hasUsableStoredAuthSession(payload: StoredAuthPayload, now = Date.now()) {
  return hasUnexpiredSessionCookie(payload.cookie, now) || hasUnexpiredSessionCache(payload.sessionCache, now);
}

function hasUnexpiredSessionCookie(raw: string | null, now: number) {
  const parsed = parseJson<Record<string, StoredCookie>>(raw);
  if (!parsed) return false;

  return Object.entries(parsed).some(([key, cookie]) => {
    if (!key.includes('session_token')) return false;
    if (typeof cookie?.value !== 'string' || cookie.value.length === 0) return false;
    if (typeof cookie.expires !== 'string' || cookie.expires.length === 0) return true;
    return Date.parse(cookie.expires) > now;
  });
}

function hasUnexpiredSessionCache(raw: string | null, now: number) {
  const parsed = parseJson<StoredSession>(raw);
  if (!parsed?.user?.id || !parsed.session?.id) return false;
  if (typeof parsed.session.expiresAt !== 'string') return false;
  return Date.parse(parsed.session.expiresAt) > now;
}

function parseJson<T>(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
