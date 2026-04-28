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

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replaceAll('-', '+').replaceAll('_', '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function subscribeToWebPush(publicKey: string, options: { forceRefresh?: boolean } = {}) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support web push.')
  }

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription && !options.forceRefresh) return existingSubscription
  if (existingSubscription) {
    await existingSubscription.unsubscribe()
  }

  return await registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(publicKey),
    userVisibleOnly: true,
  })
}

export function serializePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) {
    throw new Error('Browser returned an incomplete push subscription.')
  }
  return {
    endpoint: json.endpoint,
    expirationTime: subscription.expirationTime ?? undefined,
    keys: {
      auth: json.keys.auth,
      p256dh: json.keys.p256dh,
    },
  }
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
