'use node'

import { v } from 'convex/values'
import webPush from 'web-push'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'

export const deliverMessageNotifications = internalAction({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@q9labs.ai'
    if (!publicKey || !privateKey) return

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

    webPush.setVapidDetails(subject, publicKey, privateKey)

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
          await webPush.sendNotification(JSON.parse(target.tokenOrEndpoint), payload)
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
    if (!publicKey || !privateKey) {
      throw new Error('Web push is not configured for this environment.')
    }

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

    webPush.setVapidDetails(subject, publicKey, privateKey)

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
          await webPush.sendNotification(JSON.parse(target.tokenOrEndpoint), payload, {
            TTL: 60,
            urgency: 'high',
          })
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
