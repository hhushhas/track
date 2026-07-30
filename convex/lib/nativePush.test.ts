import { describe, expect, it } from 'vitest'

import { apnsPayload, classifyApnsFailure } from './apns'
import { classifyFcmFailure, fcmMessage } from './fcm'

describe('native push providers', () => {
  it('builds APNs alerts with Track routing data and user presentation choices', () => {
    expect(apnsPayload({
      badge: 4,
      body: 'New activity',
      data: { intentId: 'intent-1', url: '/projects' },
      environment: 'development',
      expiresAt: Date.now() + 60_000,
      platform: 'ios',
      soundEnabled: false,
      title: 'Track',
      token: 'device-token',
    })).toEqual({
      aps: {
        alert: { title: 'Track', body: 'New activity' },
        badge: 4,
      },
      intentId: 'intent-1',
      url: '/projects',
    })
  })

  it('classifies permanent APNs device and credential failures', () => {
    expect(classifyApnsFailure({ status: 410, reason: 'Unregistered' })).toEqual({
      category: 'device_not_registered',
      permanent: true,
    })
    expect(classifyApnsFailure({ status: 403, reason: 'ExpiredProviderToken' })).toEqual({
      category: 'invalid_credentials',
      permanent: true,
    })
    expect(classifyApnsFailure({ status: 503 })).toEqual({
      category: 'provider_unavailable',
      permanent: false,
    })
  })

  it('classifies permanent and retryable FCM failures', () => {
    expect(classifyFcmFailure('messaging/registration-token-not-registered')).toEqual({
      category: 'device_not_registered',
      permanent: true,
    })
    expect(classifyFcmFailure('messaging/mismatched-credential')).toEqual({
      category: 'invalid_credentials',
      permanent: true,
    })
    expect(classifyFcmFailure('messaging/server-unavailable')).toEqual({
      category: 'provider_unavailable',
      permanent: false,
    })
  })

  it('uses separate Android channels for audible and silent delivery', () => {
    const common = {
      body: 'Sensitive message',
      data: { intentId: 'intent-1' },
      environment: 'production' as const,
      expiresAt: Date.now() + 60_000,
      platform: 'android' as const,
      title: 'Aisha · #launch',
      token: 'fcm-token',
    }
    expect(fcmMessage({ ...common, soundEnabled: true }).android?.notification)
      .toMatchObject({ channelId: 'track-default', sound: 'default' })
    expect(fcmMessage({ ...common, soundEnabled: false }).android?.notification)
      .toEqual({ channelId: 'track-silent' })
  })
})
