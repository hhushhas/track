export const invitationLifetimeMs = 14 * 24 * 60 * 60 * 1000

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export async function hashInvitationToken(token: string) {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createInvitationToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`
}
