'use node'

import { v } from 'convex/values'
import webPush from 'web-push'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

export const deliverMessageNotifications = internalAction({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@q9labs.ai'
    if (!publicKey || !privateKey) return

    const notification = await ctx.runQuery(internal.notifications.collectMessageNotificationTargets, {
      messageId: args.messageId,
    })
    if (!notification || notification.targets.length === 0) return

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
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : null
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
