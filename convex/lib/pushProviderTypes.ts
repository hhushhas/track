export type PushFailureCategory =
  | 'device_not_registered'
  | 'invalid_credentials'
  | 'invalid_payload'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'network_error'
  | 'unknown_permanent'

export type NativePushInput = {
  badge?: number
  body: string
  data: Record<string, string>
  environment: 'development' | 'preview' | 'production'
  expiresAt: number
  platform: 'ios' | 'android'
  soundEnabled: boolean
  title: string
  token: string
}

export type NativePushResult =
  | {
      ok: true
      latencyMs: number
      provider: 'apns' | 'fcm'
      providerMessageId?: string
    }
  | {
      ok: false
      category: PushFailureCategory
      latencyMs: number
      permanent: boolean
      provider: 'apns' | 'fcm'
    }
