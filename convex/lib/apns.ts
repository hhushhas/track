'use node'

import { connect, constants, type ClientHttp2Session } from 'node:http2'

import { importPKCS8, SignJWT } from 'jose'

import type { NativePushInput, NativePushResult, PushFailureCategory } from './pushProviderTypes'

type ApnsConfiguration = {
  bundleId: string
  keyId: string
  privateKey: string
  teamId: string
}

type ApnsEnvironment = 'development' | 'production'

type ApnsResponse = {
  apnsId?: string
  body: string
  status: number
}

const cachedProviderTokens = new Map<string, { expiresAt: number; value: string }>()

function apnsConfiguration(environment: ApnsEnvironment): ApnsConfiguration | null {
  const environmentPrefix = environment === 'development' ? 'APNS_DEVELOPMENT' : 'APNS_PRODUCTION'
  const bundleId = process.env.APNS_BUNDLE_ID
  const keyId = process.env[`${environmentPrefix}_KEY_ID`] ?? process.env.APNS_KEY_ID
  const privateKey = (
    process.env[`${environmentPrefix}_PRIVATE_KEY`] ?? process.env.APNS_PRIVATE_KEY
  )?.replaceAll('\\n', '\n')
  const teamId = process.env.APNS_TEAM_ID
  if (!bundleId || !keyId || !privateKey || !teamId) return null
  return { bundleId, keyId, privateKey, teamId }
}

async function providerToken(configuration: ApnsConfiguration) {
  const now = Date.now()
  const cacheKey = `${configuration.teamId}:${configuration.keyId}:${configuration.privateKey}`
  const cachedProviderToken = cachedProviderTokens.get(cacheKey)
  if (cachedProviderToken && cachedProviderToken.expiresAt > now) return cachedProviderToken.value
  const key = await importPKCS8(configuration.privateKey, 'ES256')
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: configuration.keyId })
    .setIssuer(configuration.teamId)
    .setIssuedAt(Math.floor(now / 1_000))
    .sign(key)
  cachedProviderTokens.set(cacheKey, { value, expiresAt: now + 50 * 60 * 1_000 })
  return value
}

export function apnsPayload(input: NativePushInput) {
  return {
    aps: {
      alert: { title: input.title, body: input.body },
      ...(input.badge === undefined ? {} : { badge: input.badge }),
      ...(input.soundEnabled ? { sound: 'default' } : {}),
    },
    ...input.data,
  }
}

export function classifyApnsFailure(input: { reason?: string; status?: number }): {
  category: PushFailureCategory
  permanent: boolean
} {
  if (['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(input.reason ?? '')) {
    return { category: 'device_not_registered', permanent: true }
  }
  if ([
    'ExpiredProviderToken',
    'Forbidden',
    'InvalidProviderToken',
    'MissingProviderToken',
  ].includes(input.reason ?? '') || input.status === 403) {
    return { category: 'invalid_credentials', permanent: true }
  }
  if (input.status === 429 || input.reason === 'TooManyRequests') {
    return { category: 'rate_limited', permanent: false }
  }
  if (input.status && input.status >= 500) {
    return { category: 'provider_unavailable', permanent: false }
  }
  if (input.status && input.status >= 400) return { category: 'invalid_payload', permanent: true }
  if (!input.status) return { category: 'network_error', permanent: false }
  return { category: 'unknown_permanent', permanent: true }
}

function sendApnsRequest(
  session: ClientHttp2Session,
  configuration: ApnsConfiguration,
  authorization: string,
  input: NativePushInput,
): Promise<ApnsResponse> {
  return new Promise((resolve, reject) => {
    const request = session.request({
      ':method': 'POST',
      ':path': `/3/device/${input.token}`,
      authorization: `bearer ${authorization}`,
      'apns-expiration': String(Math.max(0, Math.floor(input.expiresAt / 1_000))),
      'apns-priority': '10',
      'apns-push-type': 'alert',
      'apns-topic': configuration.bundleId,
      'content-type': 'application/json',
    })
    let apnsId: string | undefined
    let body = ''
    let status = 0
    request.setEncoding('utf8')
    request.setTimeout(15_000, () => {
      request.close(constants.NGHTTP2_CANCEL)
      reject(new Error('apns_request_timeout'))
    })
    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0)
      const responseId = headers['apns-id']
      apnsId = Array.isArray(responseId) ? responseId[0] : responseId
    })
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => resolve({ apnsId, body, status }))
    request.on('error', reject)
    request.end(JSON.stringify(apnsPayload(input)))
  })
}

async function sendApnsEnvironmentBatch(
  inputs: NativePushInput[],
  environment: ApnsEnvironment,
): Promise<NativePushResult[]> {
  const configuration = apnsConfiguration(environment)
  if (!configuration) {
    return inputs.map(() => ({
      ok: false,
      category: 'invalid_credentials',
      permanent: true,
      latencyMs: 0,
      provider: 'apns',
    }))
  }
  let authorization: string
  try {
    authorization = await providerToken(configuration)
  } catch {
    return inputs.map(() => ({
      ok: false,
      category: 'invalid_credentials',
      permanent: true,
      latencyMs: 0,
      provider: 'apns',
    }))
  }
  const origin = environment === 'development'
    ? 'https://api.development.push.apple.com'
    : 'https://api.push.apple.com'
  const session = connect(origin)
  session.on('error', () => undefined)
  try {
    return await Promise.all(inputs.map(async (input) => {
      const startedAt = Date.now()
      let response: ApnsResponse
      try {
        response = await sendApnsRequest(session, configuration, authorization, input)
      } catch {
        return {
          ok: false,
          category: 'network_error',
          permanent: false,
          latencyMs: Date.now() - startedAt,
          provider: 'apns',
        }
      }
      const latencyMs = Date.now() - startedAt
      if (response.status === 200) {
        return {
          ok: true,
          latencyMs,
          provider: 'apns',
          providerMessageId: response.apnsId,
        }
      }
      let reason: string | undefined
      try {
        reason = (JSON.parse(response.body) as { reason?: string }).reason
      } catch {
        reason = undefined
      }
      return {
        ok: false,
        ...classifyApnsFailure({ reason, status: response.status }),
        latencyMs,
        provider: 'apns',
      }
    }))
  } finally {
    session.close()
  }
}

export async function sendApnsBatch(inputs: NativePushInput[]): Promise<NativePushResult[]> {
  if (!inputs.length) return []
  const results: Array<NativePushResult | undefined> = Array.from({ length: inputs.length })
  const development = inputs.flatMap((input, index) =>
    input.environment === 'development' ? [{ index, input }] : [])
  const production = inputs.flatMap((input, index) =>
    input.environment === 'development' ? [] : [{ index, input }])
  const [developmentResults, productionResults] = await Promise.all([
    sendApnsEnvironmentBatch(development.map((item) => item.input), 'development'),
    sendApnsEnvironmentBatch(production.map((item) => item.input), 'production'),
  ])
  development.forEach((item, index) => {
    results[item.index] = developmentResults[index]
  })
  production.forEach((item, index) => {
    results[item.index] = productionResults[index]
  })
  return results.map((result) => result!)
}
