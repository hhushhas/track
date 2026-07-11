type EmailSignInInput = { ok: true; email: string } | { ok: false; error: string };

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
