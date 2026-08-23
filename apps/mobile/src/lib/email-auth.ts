type EmailSignInInput = { ok: true; email: string } | { ok: false; error: string };
type EmailSignUpInput = { ok: true; email: string; name: string } | { ok: false; error: string };

/** Mirrors `minPasswordLength` in the Better Auth server config. */
const MIN_PASSWORD_LENGTH = 10;

export function validateEmailSignIn(email: string, password: string): EmailSignInInput {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!password) {
    return { ok: false, error: 'Enter your password.' };
  }

  return { ok: true, email: normalizedEmail };
}

export function validateEmailSignUp(name: string, email: string, password: string): EmailSignUpInput {
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    return { ok: false, error: 'Enter your name.' };
  }
  if (!normalizedEmail.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  return { ok: true, email: normalizedEmail, name: trimmedName };
}

export function requiresTwoFactor(data: unknown) {
  return Boolean(data && typeof data === 'object' && 'twoFactorRedirect' in data && data.twoFactorRedirect === true);
}
