import { shouldNotifyForMessage } from '@track/shared'

export const notificationPermissionLabels = {
  default: 'Not enabled',
  denied: 'Blocked',
  granted: 'Enabled',
  unsupported: 'Unsupported',
} as const

export type WebNotificationPermission = keyof typeof notificationPermissionLabels

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return await Notification.requestPermission()
}

export function shouldNotifyForIncomingMessage(input: {
  authorId: string
  currentUserId: string
  globalMode: 'all' | 'mentions' | 'none'
  groupMode: 'inherit' | 'all' | 'mentions' | 'none'
  mentions: Array<string>
}) {
  if (input.authorId === input.currentUserId) return false
  return shouldNotifyForMessage({
    globalMode: input.globalMode,
    groupMode: input.groupMode,
    mentioned: input.mentions.includes(input.currentUserId),
  })
}

export async function showMessageNotification(input: {
  title: string
  body: string
  tag: string
  url: string
}) {
  if (getNotificationPermission() !== 'granted') return

  const options = {
    body: input.body,
    badge: '/logo192.png',
    data: { url: input.url },
    icon: '/logo192.png',
    tag: input.tag,
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(input.title, options)
    return
  }

  new Notification(input.title, options)
}
