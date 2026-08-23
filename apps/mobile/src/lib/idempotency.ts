/**
 * A key that lets a retry repeat a mutation without repeating its effect.
 *
 * Hermes does not guarantee `crypto.randomUUID`, and a submit handler that
 * generates its key inline dies before its own error handling can run. The
 * fallback keeps the retry contract intact: collision odds across one device's
 * in-flight submits are negligible, and the server only compares keys within a
 * single project.
 */
export function idempotencyKey() {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  const random = () => Math.random().toString(36).slice(2, 12);
  return `k-${Date.now().toString(36)}-${random()}-${random()}`;
}
