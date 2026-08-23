import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authClientMock = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
}));

vi.mock('./auth-client', () => ({ authClient: authClientMock }));

async function loadBypass(password?: string) {
  vi.stubEnv('EXPO_PUBLIC_DEV_AUTH_BYPASS', '1');
  vi.stubEnv('EXPO_PUBLIC_DEV_AUTH_BYPASS_PASSWORD', password ?? '');
  return await import('./dev-auth-bypass');
}

describe('mobile development auth bypass', () => {
  beforeEach(() => {
    vi.resetModules();
    authClientMock.signIn.email.mockReset();
    authClientMock.signUp.email.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('authenticates the development identity before enabling the bypass', async () => {
    authClientMock.signIn.email.mockResolvedValue({ error: null });
    const bypass = await loadBypass('development-password');

    await expect(bypass.enableDevAuthBypass()).resolves.toBeUndefined();
    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      email: 'developer@track.local',
      password: 'development-password',
      callbackURL: '/',
    });
    expect(authClientMock.signUp.email).not.toHaveBeenCalled();
  });

  it('creates the development identity when it has not signed in before', async () => {
    authClientMock.signIn.email.mockResolvedValue({ error: { code: 'INVALID_CREDENTIALS' } });
    authClientMock.signUp.email.mockResolvedValue({ error: null });
    const bypass = await loadBypass('development-password');

    await expect(bypass.enableDevAuthBypass()).resolves.toBeUndefined();
    expect(authClientMock.signUp.email).toHaveBeenCalledWith({
      email: 'developer@track.local',
      password: 'development-password',
      name: 'Track Developer',
      callbackURL: '/',
    });
  });

});
