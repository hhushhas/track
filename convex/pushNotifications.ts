'use node'

import { v } from 'convex/values'
import webPush from 'web-push'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'

type NotificationTarget = {
  id: string
  platform: 'web' | 'ios' | 'android'
  tokenOrEndpoint: string
}

async function sendExpoPush(input: {
  body: string
  data?: Record<string, string>
  target: NotificationTarget
  title: string
}) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: input.target.tokenOrEndpoint,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      sound: 'default',
    }),
  })

  if (!response.ok) throw new Error(`expo_push_failed_${response.status}`)
  const payload = await response.json() as {
    data?: { status?: string; details?: { error?: string } }
  }
  if (payload.data?.status === 'error') {
    throw new Error(payload.data.details?.error ?? 'expo_push_error')
  }
}

export const deliverMessageNotifications = internalAction({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@q9labs.ai'

    console.info('[Track push] deliverMessageNotifications started', {
      messageId: args.messageId,
      vapidConfigured: Boolean(publicKey && privateKey),
    })

    const notification = await ctx.runQuery(internal.notifications.collectMessageNotificationTargets, {
      messageId: args.messageId,
    })
    if (!notification || notification.targets.length === 0) {
      console.info('[Track push] deliverMessageNotifications skipped without targets', {
        hasNotification: Boolean(notification),
        messageId: args.messageId,
      })
      return
    }

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey)
    }

    const payload = JSON.stringify({
      body: notification.body.slice(0, 160),
      icon: '/logo192.png',
      tag: `track-message-${args.messageId}`,
      title: `${notification.senderName} in ${notification.groupName}`,
      url: notification.url,
    })

    await Promise.all(
      notification.targets.map(async (target) => {
        try {
          if (target.platform === 'web') {
            if (!publicKey || !privateKey) return
            await webPush.sendNotification(JSON.parse(target.tokenOrEndpoint), payload)
          } else {
            await sendExpoPush({
              target,
              title: `${notification.senderName} in ${notification.groupName}`,
              body: notification.body.slice(0, 160),
              data: {
                groupId: String(notification.groupId),
                messageId: String(args.messageId),
                projectId: String(notification.projectId),
                url: notification.url,
              },
            })
          }
          console.info('[Track push] message notification sent', {
            messageId: args.messageId,
            subscriptionId: target.id,
          })
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : null
          console.warn('[Track push] message notification failed', {
            messageId: args.messageId,
            statusCode,
            subscriptionId: target.id,
          })
          if (statusCode === 404 || statusCode === 410) {
            await ctx.runMutation(internal.notifications.disableSubscription, {
              subscriptionId: target.id,
            })
          }
          if (
            error instanceof Error &&
            (error.message === 'DeviceNotRegistered' ||
              error.message === 'expo_push_failed_400')
          ) {
            await ctx.runMutation(internal.notifications.disableSubscription, {
              subscriptionId: target.id,
            })
          }
        }
      }),
    )
  },
})

export const sendTestNotification = action({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<{ attempted: number; sent: number; failed: number }> => {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@q9labs.ai'

    console.info('[Track push] sendTestNotification started', {
      userId: args.userId,
      vapidConfigured: Boolean(publicKey && privateKey),
    })

    const targets = await ctx.runQuery(internal.notifications.collectUserNotificationTargets, {
      userId: args.userId,
    })
    console.info('[Track push] sendTestNotification targets collected', {
      targetCount: targets.length,
      userId: args.userId,
    })
    if (targets.length === 0) return { attempted: 0, sent: 0, failed: 0 }

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey)
    }

    const payload = JSON.stringify({
      body: 'If you can see this, remote browser alerts are connected.',
      icon: '/logo192.png',
      requireInteraction: true,
      tag: `track-test-${Date.now()}`,
      timestamp: Date.now(),
      title: 'Track test alert',
      url: '/workspace',
      vibrate: [80, 40, 80],
    })

    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          if (target.platform === 'web') {
            if (!publicKey || !privateKey) throw new Error('web_push_not_configured')
            await webPush.sendNotification(JSON.parse(target.tokenOrEndpoint), payload, {
              TTL: 60,
              urgency: 'high',
            })
          } else {
            await sendExpoPush({
              target,
              title: 'Track test alert',
              body: 'If you can see this, mobile alerts are connected.',
              data: { url: '/workspace' },
            })
          }
          console.info('[Track push] test notification sent', {
            subscriptionId: target.id,
            userId: args.userId,
          })
          return 'sent'
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : null
          console.warn('[Track push] test notification failed', {
            statusCode,
            subscriptionId: target.id,
            userId: args.userId,
          })
          if (statusCode === 404 || statusCode === 410) {
            await ctx.runMutation(internal.notifications.disableSubscription, {
              subscriptionId: target.id,
            })
          }
          return 'failed'
        }
      }),
    )

    const sent = results.filter((result) => result === 'sent').length
    console.info('[Track push] sendTestNotification completed', {
      attempted: targets.length,
      failed: targets.length - sent,
      sent,
      userId: args.userId,
    })
    return {
      attempted: targets.length,
      failed: targets.length - sent,
      sent,
    }
  },
})
